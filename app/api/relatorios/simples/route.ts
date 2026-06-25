import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { fetchAll } from '@/lib/supabase/fetchAll'

type DeclaracaoRow = {
  competencia: string
  receita_bruta_mes: number | null
  valor_total_devido: number | null
  numero_recibo: string | null
  nome_arquivo: string | null
}

type DocumentoRow = {
  id: string
  chave_acesso: string | null
  numero: string | null
  serie: string | null
  modelo: string | null
  data_emissao: string | null
  data_competencia: string | null
  emitente_cnpj: string | null
  emitente_nome: string | null
  destinatario_cnpj: string | null
  destinatario_nome: string | null
  valor_total: number | null
  valor_desconto: number | null
  tipo_movimento: string | null
  impacto_receita: string | null
  origem_devolucao: string | null
  status: string | null
  nome_arquivo: string | null
}

type ResumoPeriodo = {
  competencia: string
  receita_pgdas: number
  valor_das_pgdas: number
  xml_receita_bruta: number
  xml_devolucoes: number
  xml_receita_liquida: number
  diferenca: number
  diferenca_percentual: number | null
  qtd_xml_saida: number
  qtd_xml_entrada: number
  qtd_xml_devolucao: number
  status: 'ok' | 'atencao' | 'critico' | 'sem_pgdas' | 'sem_xml'
  pgdas_arquivo?: string
  pgdas_recibo?: string
}

function normalizarCompetencia(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d{2}\/\d{4}$/.test(trimmed)) return trimmed
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const [ano, mes] = trimmed.split('-')
    return `${mes}/${ano}`
  }
  return trimmed
}

function competenciaKey(value: string): number {
  const comp = normalizarCompetencia(value) ?? value
  const match = comp.match(/^(\d{2})\/(\d{4})$/)
  if (!match) return 0
  return Number(match[2]) * 100 + Number(match[1])
}

function dentroDoPeriodo(competencia: string | null, inicio: string | null, fim: string | null): boolean {
  const comp = normalizarCompetencia(competencia)
  if (!comp) return false
  const key = competenciaKey(comp)
  const inicioKey = inicio ? competenciaKey(inicio) : null
  const fimKey = fim ? competenciaKey(fim) : null
  if (inicioKey !== null && key < inicioKey) return false
  if (fimKey !== null && key > fimKey) return false
  return true
}

function classificarStatus(receitaPgdas: number, receitaXml: number): ResumoPeriodo['status'] {
  if (receitaPgdas <= 0 && receitaXml > 0) return 'sem_pgdas'
  if (receitaPgdas > 0 && receitaXml <= 0) return 'sem_xml'
  if (receitaPgdas <= 0 && receitaXml <= 0) return 'ok'

  const diferencaPercentual = Math.abs(receitaXml - receitaPgdas) / receitaPgdas
  if (diferencaPercentual <= 0.01) return 'ok'
  if (diferencaPercentual <= 0.05) return 'atencao'
  return 'critico'
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const empresaId = url.searchParams.get('empresa_id')
  const competenciaInicio = normalizarCompetencia(url.searchParams.get('competencia_inicio'))
  const competenciaFim = normalizarCompetencia(url.searchParams.get('competencia_fim'))

  if (!empresaId) return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  try {
    const declaracoes = await fetchAll((from, to) =>
      supabase
        .from('sn_declaracoes')
        .select('competencia, receita_bruta_mes, valor_total_devido, numero_recibo, nome_arquivo')
        .eq('empresa_id', empresaId)
        .range(from, to),
    ) as DeclaracaoRow[]

    const documentos = await fetchAll((from, to) =>
      supabase
        .from('fa_documentos_fiscais')
        .select('id, chave_acesso, numero, serie, modelo, data_emissao, data_competencia, emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, valor_total, valor_desconto, tipo_movimento, impacto_receita, origem_devolucao, status, nome_arquivo')
        .eq('empresa_id', empresaId)
        .range(from, to),
    ) as DocumentoRow[]

    const declaracoesFiltradas = declaracoes.filter(d =>
      dentroDoPeriodo(d.competencia, competenciaInicio, competenciaFim),
    )
    const documentosFiltrados = documentos.filter(d =>
      d.status !== 'cancelada' && dentroDoPeriodo(d.data_competencia, competenciaInicio, competenciaFim),
    )

    const resumo = new Map<string, ResumoPeriodo>()

    function getResumo(competencia: string): ResumoPeriodo {
      const comp = normalizarCompetencia(competencia) ?? competencia
      const atual = resumo.get(comp)
      if (atual) return atual

      const novo: ResumoPeriodo = {
        competencia: comp,
        receita_pgdas: 0,
        valor_das_pgdas: 0,
        xml_receita_bruta: 0,
        xml_devolucoes: 0,
        xml_receita_liquida: 0,
        diferenca: 0,
        diferenca_percentual: null,
        qtd_xml_saida: 0,
        qtd_xml_entrada: 0,
        qtd_xml_devolucao: 0,
        status: 'ok',
      }
      resumo.set(comp, novo)
      return novo
    }

    for (const declaracao of declaracoesFiltradas) {
      const comp = normalizarCompetencia(declaracao.competencia)
      if (!comp) continue
      const row = getResumo(comp)
      row.receita_pgdas = declaracao.receita_bruta_mes ?? 0
      row.valor_das_pgdas = declaracao.valor_total_devido ?? 0
      row.pgdas_arquivo = declaracao.nome_arquivo ?? undefined
      row.pgdas_recibo = declaracao.numero_recibo ?? undefined
    }

    for (const documento of documentosFiltrados) {
      const comp = normalizarCompetencia(documento.data_competencia)
      if (!comp) continue
      const row = getResumo(comp)
      const valor = documento.valor_total ?? 0

      if (documento.tipo_movimento === 'entrada') row.qtd_xml_entrada++
      if (documento.impacto_receita === 'soma_receita') {
        row.xml_receita_bruta += valor
        row.qtd_xml_saida++
      }
      if (documento.impacto_receita === 'reduz_receita') {
        row.xml_devolucoes += valor
        row.qtd_xml_devolucao++
      }
    }

    const periodos = Array.from(resumo.values())
      .map(row => {
        const liquida = row.xml_receita_bruta - row.xml_devolucoes
        const diferenca = liquida - row.receita_pgdas
        return {
          ...row,
          xml_receita_liquida: liquida,
          diferenca,
          diferenca_percentual: row.receita_pgdas > 0 ? diferenca / row.receita_pgdas : null,
          status: classificarStatus(row.receita_pgdas, liquida),
        }
      })
      .sort((a, b) => competenciaKey(a.competencia) - competenciaKey(b.competencia))

    const documentosUsados = documentosFiltrados
      .map(doc => ({
        competencia: normalizarCompetencia(doc.data_competencia),
        chave_acesso: doc.chave_acesso,
        numero: doc.numero,
        serie: doc.serie,
        modelo: doc.modelo,
        data_emissao: doc.data_emissao,
        tipo_movimento: doc.tipo_movimento,
        impacto_receita: doc.impacto_receita,
        origem_devolucao: doc.origem_devolucao,
        emitente_cnpj: doc.emitente_cnpj,
        emitente_nome: doc.emitente_nome,
        destinatario_cnpj: doc.destinatario_cnpj,
        destinatario_nome: doc.destinatario_nome,
        valor_total: doc.valor_total ?? 0,
        valor_desconto: doc.valor_desconto ?? 0,
        nome_arquivo: doc.nome_arquivo,
      }))
      .sort((a, b) => competenciaKey(a.competencia ?? '') - competenciaKey(b.competencia ?? ''))

    return NextResponse.json({ periodos, documentos: documentosUsados })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
