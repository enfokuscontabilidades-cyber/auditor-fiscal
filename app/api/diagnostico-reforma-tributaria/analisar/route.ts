import { NextResponse, type NextRequest } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { lerXmlDiagnostico, type ItemXmlDiagnostico } from '@/lib/fiscal/lerXmlDiagnostico'
import { montarLinha, type SituacaoReforma } from '@/lib/fiscal/analiseReformaTributaria'
import { mascararCnpjParcial } from '@/lib/validacao/documentos'
import { verificarRateLimit, obterIpRequisicao } from '@/lib/security/rateLimit'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularPontuacao } from '@/lib/relatorioReforma/pontuacao'
import { montarDivergencias } from '@/lib/relatorioReforma/divergencias'
import { VERSAO_REGRAS_ANALISE } from '@/lib/relatorioReforma/tipos'
import { VERSAO_BASE_LEGAL } from '@/lib/relatorioReforma/baseLegal'

export const runtime = 'nodejs'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function gerarTokenRelatorio(): string {
  return randomBytes(32).toString('hex')
}

// Limites — mantidos aqui como única fonte de verdade do endpoint; o front-end
// lê os mesmos números via a resposta de erro para manter a UI consistente.
const MAX_ARQUIVOS = 10
const MAX_TAMANHO_BYTES = 5 * 1024 * 1024

type MotivoFalha = 'vazio' | 'estrutura_suspeita' | 'nao_xml' | 'documento_nao_suportado' | 'malformado' | 'duplicado' | 'muito_grande' | 'extensao_invalida'

const MENSAGENS_FALHA: Record<MotivoFalha, string> = {
  vazio: 'O arquivo está vazio.',
  estrutura_suspeita: 'O arquivo contém uma declaração de estrutura não permitida (DOCTYPE/ENTITY) e foi recusado por segurança.',
  nao_xml: 'O conteúdo não parece ser um XML válido.',
  documento_nao_suportado: 'Não localizamos a estrutura de uma NF-e (infNFe) neste arquivo.',
  malformado: 'O XML está malformado ou excede o tamanho permitido.',
  duplicado: 'Este arquivo já foi enviado nesta mesma análise.',
  muito_grande: 'O arquivo excede 5 MB.',
  extensao_invalida: 'Apenas arquivos .xml são aceitos.',
}

interface ItemResultado extends ItemXmlDiagnostico {
  alertas: string[]
  situacao: SituacaoReforma
  destacado: boolean
}

interface ResultadoArquivo {
  id: string
  arquivo: string
  ok: boolean
  motivoFalha?: MotivoFalha
  mensagemFalha?: string
  tipoDocumento?: string
  numero?: string
  serie?: string
  dataEmissao?: string | null
  emitenteMascarado?: string
  chaveAcesso?: string | null
  totalizadorIbs?: number | null
  totalizadorCbs?: number | null
  situacao?: SituacaoReforma
  camposEncontrados?: string[]
  camposAusentes?: string[]
  itens?: ItemResultado[]
  recomendacoes?: string[]
}

function piorSituacao(a: SituacaoReforma, b: SituacaoReforma): SituacaoReforma {
  const ordem: Record<SituacaoReforma, number> = { ok: 0, alerta: 1, critico: 2 }
  return ordem[b] > ordem[a] ? b : a
}

function recomendacoesPara(situacao: SituacaoReforma): string[] {
  if (situacao === 'ok') {
    return ['Continue monitorando os próximos lançamentos até a entrada em vigor das novas exigências.']
  }
  if (situacao === 'alerta') {
    return [
      'Verifique com o sistema emissor se CST, cClassTrib e alíquotas de IBS/CBS estão configurados corretamente.',
      'Confira se as alíquotas aplicadas correspondem aos percentuais de teste vigentes.',
    ]
  }
  return [
    'O sistema emissor provavelmente precisa de atualização ou configuração para gerar os grupos de IBS e CBS.',
    'Consulte o suporte do seu sistema de emissão antes das novas validações entrarem em vigor.',
  ]
}

export async function POST(request: NextRequest) {
  const ip = obterIpRequisicao(request.headers)
  const limite = verificarRateLimit(`diagnostico-analise:${ip}`, { limite: 15, janelaMs: 15 * 60 * 1000 })
  if (!limite.permitido) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, { status: 429 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler o envio.' }, { status: 400 })
  }

  const arquivos = formData.getAll('arquivos').filter((v): v is File => v instanceof File)
  const leadIdBruto = formData.get('leadId')
  const leadId = typeof leadIdBruto === 'string' && UUID_REGEX.test(leadIdBruto) ? leadIdBruto : null

  if (arquivos.length === 0) {
    return NextResponse.json({ error: 'Envie ao menos um arquivo XML.' }, { status: 400 })
  }
  if (arquivos.length > MAX_ARQUIVOS) {
    return NextResponse.json({ error: `Envie no máximo ${MAX_ARQUIVOS} arquivos por análise.` }, { status: 400 })
  }

  const hashesVistos = new Set<string>()
  const resultados: ResultadoArquivo[] = []

  for (let i = 0; i < arquivos.length; i++) {
    const arquivo = arquivos[i]
    const id = `f${i + 1}-${Date.now().toString(36)}`

    if (!/\.xml$/i.test(arquivo.name)) {
      resultados.push({ id, arquivo: arquivo.name, ok: false, motivoFalha: 'extensao_invalida', mensagemFalha: MENSAGENS_FALHA.extensao_invalida })
      continue
    }
    if (arquivo.size > MAX_TAMANHO_BYTES) {
      resultados.push({ id, arquivo: arquivo.name, ok: false, motivoFalha: 'muito_grande', mensagemFalha: MENSAGENS_FALHA.muito_grande })
      continue
    }

    // Lido inteiramente em memória; nada é gravado em disco ou em storage.
    const conteudo = await arquivo.text()

    const hash = createHash('sha256').update(conteudo).digest('hex')
    if (hashesVistos.has(hash)) {
      resultados.push({ id, arquivo: arquivo.name, ok: false, motivoFalha: 'duplicado', mensagemFalha: MENSAGENS_FALHA.duplicado })
      continue
    }
    hashesVistos.add(hash)

    const leitura = lerXmlDiagnostico(conteudo)
    if (!leitura.ok) {
      resultados.push({ id, arquivo: arquivo.name, ok: false, motivoFalha: leitura.motivo, mensagemFalha: MENSAGENS_FALHA[leitura.motivo] })
      continue
    }

    const { documento } = leitura

    const itens: ItemResultado[] = documento.itens.map(item => {
      const linha = montarLinha({ ...item })
      return { ...item, alertas: linha.alertas, situacao: linha.situacao, destacado: linha.destacado }
    })

    let situacaoDoc: SituacaoReforma = itens.length === 0 ? 'critico' : 'ok'
    for (const item of itens) situacaoDoc = piorSituacao(situacaoDoc, item.situacao)

    const algumDestacado = itens.some(i => i.destacado)
    const camposEncontrados: string[] = []
    const camposAusentes: string[] = []
    if (algumDestacado) {
      if (itens.some(i => i.cst !== '-')) camposEncontrados.push('CST do IBS/CBS'); else camposAusentes.push('CST do IBS/CBS')
      if (itens.some(i => i.cclass !== '-')) camposEncontrados.push('cClassTrib'); else camposAusentes.push('cClassTrib')
      if (itens.some(i => i.base > 0)) camposEncontrados.push('Base de cálculo'); else camposAusentes.push('Base de cálculo')
      if (itens.some(i => i.valorIbs > 0)) camposEncontrados.push('Valor de IBS'); else camposAusentes.push('Valor de IBS')
      if (itens.some(i => i.valorCbs > 0)) camposEncontrados.push('Valor de CBS'); else camposAusentes.push('Valor de CBS')
    } else {
      camposAusentes.push('Grupo de IBS/CBS (IBSCBS) não encontrado em nenhum item')
    }

    resultados.push({
      id,
      arquivo: arquivo.name,
      ok: true,
      tipoDocumento: documento.tipoDocumento,
      numero: documento.numero,
      serie: documento.serie,
      dataEmissao: documento.dataEmissao,
      emitenteMascarado: documento.emitenteCnpj ? mascararCnpjParcial(documento.emitenteCnpj) : 'Não identificado',
      chaveAcesso: documento.chaveAcesso,
      totalizadorIbs: documento.totalizadorIbs,
      totalizadorCbs: documento.totalizadorCbs,
      situacao: situacaoDoc,
      camposEncontrados,
      camposAusentes,
      itens,
      recomendacoes: recomendacoesPara(situacaoDoc),
    })
  }

  const validos = resultados.filter(r => r.ok)
  const resumo = {
    totalAnalisado: resultados.length,
    adequado: validos.filter(r => r.situacao === 'ok').length,
    atencao: validos.filter(r => r.situacao === 'alerta').length,
    critico: resultados.length - validos.filter(r => r.situacao === 'ok' || r.situacao === 'alerta').length,
  }

  // Persiste apenas o RESULTADO ESTRUTURADO (nunca o XML) sob um token de alta
  // entropia, para permitir gerar o Relatório Técnico em PDF sob demanda sem
  // reenviar dados sensíveis pela URL nem expor um id sequencial.
  let relatorioToken: string | null = null
  if (leadId) {
    try {
      const divergencias = montarDivergencias(resultados)
      const pontuacao = calcularPontuacao(resultados, divergencias)
      const divergenciasPorGravidade = divergencias.reduce<Record<string, number>>((acc, d) => {
        acc[d.gravidade] = (acc[d.gravidade] || 0) + 1
        return acc
      }, {})

      const token = gerarTokenRelatorio()
      const admin = createAdminClient()
      const { error } = await admin.from('diagnosticos_reforma_tributaria').insert({
        lead_id: leadId,
        token,
        resultados,
        resumo,
        pontuacao: pontuacao.pontuacao,
        classificacao: pontuacao.classificacao,
        total_divergencias: divergencias.length,
        divergencias_por_gravidade: divergenciasPorGravidade,
        versao_regras: VERSAO_REGRAS_ANALISE,
        versao_base_legal: VERSAO_BASE_LEGAL,
        status: 'pronto',
      })
      if (error) {
        console.error('[diagnostico-reforma-tributaria] falha ao persistir diagnóstico:', error.message)
      } else {
        relatorioToken = token
      }
    } catch (erro) {
      // Falha ao persistir não deve impedir a exibição do resultado na tela —
      // apenas o botão de PDF ficará indisponível nesta análise.
      console.error('[diagnostico-reforma-tributaria] exceção ao persistir diagnóstico:', erro instanceof Error ? erro.message : erro)
      relatorioToken = null
    }
  }

  return NextResponse.json({ ok: true, resultados, resumo, relatorioToken })
}
