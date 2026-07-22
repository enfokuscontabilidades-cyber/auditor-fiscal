import fs from 'node:fs'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

function carregarEnvLocal() {
  if (!fs.existsSync('.env.local')) return
  for (const linha of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = linha.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

function numero(valor) {
  const convertido = Number(valor)
  return Number.isFinite(convertido) ? convertido : 0
}

function arredondar(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

async function buscarTudo(criarConsulta, tamanhoPagina = 1000) {
  const resultado = []
  for (let inicio = 0; ; inicio += tamanhoPagina) {
    const { data, error } = await criarConsulta(inicio, inicio + tamanhoPagina - 1)
    if (error) throw error
    const pagina = data ?? []
    resultado.push(...pagina)
    if (pagina.length < tamanhoPagina) return resultado
  }
}

carregarEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRole) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias em .env.local.')
}

const auditarTodas = process.argv.includes('--todas')
const termoEmpresa = process.argv.slice(2).filter(arg => arg !== '--todas').join(' ').trim() || 'SC Industria'
const supabase = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: empresas, error: erroEmpresas } = await supabase
  .from('empresas')
  .select('id, org_id, razao_social, nome_fantasia, cnpj')
  .or(`razao_social.ilike.%${termoEmpresa}%,nome_fantasia.ilike.%${termoEmpresa}%`)
  .limit(20)

if (erroEmpresas) throw erroEmpresas
if (!empresas?.length) {
  console.log(JSON.stringify({ termo_empresa: termoEmpresa, empresas_encontradas: 0 }, null, 2))
  process.exit(2)
}

if (empresas.length > 1 && !auditarTodas) {
  console.log(JSON.stringify({
    termo_empresa: termoEmpresa,
    empresas_encontradas: empresas.length,
    instrucao: 'Refine o termo ou repita com --todas.',
    empresas: empresas.map(empresa => ({
      id: empresa.id,
      razao_social: empresa.razao_social,
      nome_fantasia: empresa.nome_fantasia,
      cnpj: empresa.cnpj,
    })),
  }, null, 2))
  process.exit(3)
}

const auditorias = []
for (const empresa of empresas) {
  const documentos = await buscarTudo((inicio, fim) => supabase
    .from('fa_documentos_fiscais')
    .select('id, tipo_documento, tipo_movimento, numero, serie, modelo, data_emissao, data_competencia, emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, chave_acesso, origem, valor_total, valor_produtos, valor_servicos, valor_desconto, valor_frete, valor_seguro, valor_outras_despesas, valor_icms, valor_pis, valor_cofins, valor_st, valor_ipi, status, parsed_data')
    .eq('empresa_id', empresa.id)
    .range(inicio, fim))

  const itens = await buscarTudo((inicio, fim) => supabase
    .from('fa_documentos_itens')
    .select('id, documento_id, item_numero, codigo_produto, descricao, ncm, cest, cfop, unidade, quantidade, valor_unitario, valor_total, valor_desconto, valor_frete, valor_seguro, valor_outras_despesas, cst_icms, csosn, valor_bc_icms, aliquota_icms, valor_icms, valor_bc_st, valor_st, cst_pis, valor_pis, cst_cofins, valor_cofins, cst_ipi, valor_bc_ipi, aliquota_ipi, valor_ipi, tipo_movimento')
    .eq('empresa_id', empresa.id)
    .range(inicio, fim))

  const legado = await buscarTudo((inicio, fim) => supabase
    .from('fa_arquivos_xml')
    .select('id, chave_nfe, tipo_operacao, status, valor_total')
    .eq('empresa_id', empresa.id)
    .range(inicio, fim))

  const legadoEntradas = await buscarTudo((inicio, fim) => supabase
    .from('fa_arquivos_xml')
    .select('id, chave_nfe, numero_nf, data_emissao, status, valor_total, parsed_data')
    .eq('empresa_id', empresa.id)
    .eq('tipo_operacao', 'entrada')
    .neq('status', 'cancelada')
    .order('created_at', { ascending: false })
    .range(inicio, fim))

  const itensPorDocumento = new Map()
  for (const item of itens) {
    const atual = itensPorDocumento.get(item.documento_id) ?? {
      quantidade: 0,
      valor_total: 0,
      base_icms: 0,
      icms: 0,
      st: 0,
      ipi: 0,
      pis: 0,
      cofins: 0,
      grupos_icms: 0,
    }
    atual.quantidade += 1
    atual.valor_total += numero(item.valor_total)
    atual.base_icms += numero(item.valor_bc_icms)
    atual.icms += numero(item.valor_icms)
    atual.st += numero(item.valor_st)
    atual.ipi += numero(item.valor_ipi)
    atual.pis += numero(item.valor_pis)
    atual.cofins += numero(item.valor_cofins)
    if (item.cst_icms || item.csosn) atual.grupos_icms += 1
    itensPorDocumento.set(item.documento_id, atual)
  }

  const ativos = documentos.filter(documento => documento.status !== 'cancelada')
  const entradas = ativos.filter(documento => ['entrada', 'devolucao_venda'].includes(documento.tipo_movimento))
  const saidas = ativos.filter(documento => ['saida', 'devolucao_compra'].includes(documento.tipo_movimento))
  const nfses = ativos.filter(documento => documento.tipo_documento === 'nfse' || documento.origem === 'xml_nfse')
  const dadosNfse = nfses.map(documento => {
    const meta = documento.parsed_data?.metadados ?? {}
    const agregado = itensPorDocumento.get(documento.id)
    const baseIss = numero(meta.base_calculo_iss) || Math.max(
      0,
      numero(meta.valor_servicos ?? documento.valor_servicos)
        - numero(meta.valor_deducoes)
        - numero(meta.desconto_incondicionado),
    )
    const valorIss = numero(meta.valor_iss)
    const aliquotaIss = numero(meta.aliquota_iss) || (baseIss > 0 && valorIss > 0 ? (valorIss / baseIss) * 100 : 0)
    return {
      numero: documento.numero,
      competencia: documento.data_competencia,
      itens: agregado?.quantidade ?? 0,
      valor_servicos: arredondar(numero(documento.valor_servicos)),
      soma_itens: arredondar(numero(agregado?.valor_total)),
      codigo_servico: meta.item_lista_servico ?? null,
      codigo_tributacao_municipio: meta.codigo_tributacao_municipio ?? null,
      municipio_codigo: meta.municipio_codigo ?? null,
      base_iss: arredondar(baseIss),
      aliquota_iss: arredondar(aliquotaIss),
      valor_iss: arredondar(valorIss),
      iss_retido: meta.iss_retido === true,
      valor_iss_retido: arredondar(numero(meta.valor_iss_retido)),
      conciliado_como_servico: (agregado?.quantidade ?? 0) > 0
        && Math.abs(numero(documento.valor_servicos) - numero(agregado?.valor_total)) <= 0.01,
    }
  })
  const amostraNfse = dadosNfse.slice(0, 20)
  const amostraDivergente = []
  let icmsCabecalho = 0
  let icmsItens = 0
  let icmsConsolidado = 0
  let documentosSemItens = 0
  let documentosIcmsSomenteItens = 0
  let documentosIcmsZero = 0
  let documentosIcmsNaoInformado = 0
  let documentosIcmsDivergente = 0
  const legadoUnico = new Map()
  const icmsLegadoPorChave = new Map()
  for (const registro of legadoEntradas) {
    const chave = registro.chave_nfe || `${registro.numero_nf ?? ''}|${registro.data_emissao ?? ''}|${registro.valor_total ?? 0}`
    if (!legadoUnico.has(chave)) legadoUnico.set(chave, registro)
  }
  let itensEntradaLegado = 0
  let icmsItensEntradaLegado = 0
  let documentosLegadoComIcms = 0
  const amostraLegadoComIcms = []
  for (const [chave, registro] of legadoUnico) {
    const itensEntrada = Array.isArray(registro.parsed_data?.itens_entrada) ? registro.parsed_data.itens_entrada : []
    itensEntradaLegado += itensEntrada.length
    const icmsDocumento = itensEntrada.reduce((soma, item) => soma + numero(item?.valor_icms), 0)
    icmsLegadoPorChave.set(chave, arredondar(icmsDocumento))
    icmsItensEntradaLegado += icmsDocumento
    if (icmsDocumento > 0) {
      documentosLegadoComIcms += 1
      amostraLegadoComIcms.push({ chave_acesso: chave, numero: registro.numero_nf, icms_itens_legado: arredondar(icmsDocumento) })
    }
  }

  for (const documento of entradas) {
    const agregado = itensPorDocumento.get(documento.id)
    const cabecalho = numero(documento.valor_icms)
    const somaItens = arredondar(agregado?.icms ?? 0)
    icmsCabecalho += cabecalho
    icmsItens += somaItens
    if (!agregado?.quantidade) documentosSemItens += 1

    let consolidado = cabecalho
    let situacao = 'cabecalho'
    if (cabecalho <= 0 && somaItens > 0) {
      consolidado = somaItens
      situacao = 'itens'
      documentosIcmsSomenteItens += 1
    } else if (cabecalho > 0 && somaItens > 0 && Math.abs(cabecalho - somaItens) > 0.01) {
      situacao = 'divergente'
      documentosIcmsDivergente += 1
    } else if (cabecalho === 0 && somaItens === 0 && (agregado?.grupos_icms ?? 0) > 0) {
      situacao = 'zero'
      documentosIcmsZero += 1
    } else if (cabecalho === 0 && somaItens === 0) {
      situacao = 'nao_informado'
      documentosIcmsNaoInformado += 1
    }
    icmsConsolidado += consolidado

    if (situacao === 'itens' || situacao === 'divergente') {
      amostraDivergente.push({
        numero: documento.numero,
        chave_acesso: documento.chave_acesso,
        competencia: documento.data_competencia,
        icms_cabecalho: arredondar(cabecalho),
        icms_itens: somaItens,
        icms_consolidado: arredondar(consolidado),
        situacao,
      })
    }
  }

  const estruturadosEntradaPorChave = new Map(entradas.map(documento => [documento.chave_acesso || `${documento.numero ?? ''}|${documento.data_emissao ?? ''}|${documento.valor_total ?? 0}`, documento]))
  const legadoAusenteEstruturado = [...legadoUnico.entries()].filter(([chave]) => !estruturadosEntradaPorChave.has(chave))
  const icmsRecuperavelLegado = [...legadoUnico.keys()].reduce((total, chave) => {
    const estruturado = estruturadosEntradaPorChave.get(chave)
    if (!estruturado) return total + numero(icmsLegadoPorChave.get(chave))
    const agregado = itensPorDocumento.get(estruturado.id)
    const estruturadoTemIcms = numero(estruturado.valor_icms) > 0 || numero(agregado?.icms) > 0
    return estruturadoTemIcms ? total : total + numero(icmsLegadoPorChave.get(chave))
  }, 0)

  auditorias.push({
    empresa: {
      id: empresa.id,
      razao_social: empresa.razao_social,
      nome_fantasia: empresa.nome_fantasia,
      cnpj: empresa.cnpj,
    },
    documentos: {
      estruturados_total: documentos.length,
      ativos: ativos.length,
      entradas: entradas.length,
      saidas: saidas.length,
      cancelados: documentos.length - ativos.length,
      legado_total: legado.length,
      sem_itens_entre_entradas: documentosSemItens,
    },
    entradas: {
      valor_total_cabecalho: arredondar(entradas.reduce((soma, documento) => soma + numero(documento.valor_total), 0)),
      valor_produtos_cabecalho: arredondar(entradas.reduce((soma, documento) => soma + numero(documento.valor_produtos), 0)),
      icms_cabecalho: arredondar(icmsCabecalho),
      icms_itens: arredondar(icmsItens),
      icms_consolidado_relatorio: arredondar(icmsConsolidado),
      icms_somente_nos_itens: documentosIcmsSomenteItens,
      icms_zero: documentosIcmsZero,
      icms_nao_informado: documentosIcmsNaoInformado,
      icms_divergente_cabecalho_itens: documentosIcmsDivergente,
      legado_documentos_unicos: legadoUnico.size,
      legado_itens: itensEntradaLegado,
      legado_icms_itens: arredondar(icmsItensEntradaLegado),
      legado_documentos_com_icms: documentosLegadoComIcms,
      relatorio_corrigido_documentos_estimados: entradas.length + legadoAusenteEstruturado.length,
      relatorio_corrigido_valor_total_estimado: arredondar(
        entradas.reduce((soma, documento) => soma + numero(documento.valor_total), 0)
        + legadoAusenteEstruturado.reduce((soma, [, registro]) => soma + numero(registro.valor_total), 0),
      ),
      relatorio_corrigido_icms_estimado: arredondar(icmsConsolidado + icmsRecuperavelLegado),
      legado_documentos_ausentes_na_base_estruturada: legadoAusenteEstruturado.length,
    },
    nfse: {
      documentos: nfses.length,
      valor_servicos: arredondar(nfses.reduce((soma, documento) => soma + numero(documento.valor_servicos), 0)),
      base_iss: arredondar(dadosNfse.reduce((soma, documento) => soma + numero(documento.base_iss), 0)),
      iss: arredondar(dadosNfse.reduce((soma, documento) => soma + numero(documento.valor_iss), 0)),
      iss_retido: arredondar(dadosNfse.reduce((soma, documento) => soma + numero(documento.valor_iss_retido), 0)),
      conciliados_como_servico: dadosNfse.filter(documento => documento.conciliado_como_servico).length,
      amostra_limitada_a: 20,
      amostra: amostraNfse,
    },
    amostra_icms_somente_itens_ou_divergente: amostraDivergente.slice(0, 20),
    amostra_icms_preservado_no_legado: amostraLegadoComIcms.slice(0, 20),
  })
}

console.log(JSON.stringify({ termo_empresa: termoEmpresa, empresas_encontradas: auditorias.length, auditorias }, null, 2))
