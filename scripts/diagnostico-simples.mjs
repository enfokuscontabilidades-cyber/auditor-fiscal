// Script de diagnóstico — executa com: node scripts/diagnostico-simples.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Ler .env.local
const envPath = resolve(process.cwd(), '.env.local')
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map((p, i) => i === 0 ? p.trim() : l.slice(l.indexOf('=') + 1).trim()))
)

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY,
)

// Buscar empresa
const { data: empresas } = await supabase
  .from('empresas')
  .select('id, razao_social, cnpj')
  .ilike('razao_social', '%BENESSE%')

if (!empresas?.length) { console.log('Empresa não encontrada'); process.exit(1) }
const empresa = empresas[0]
console.log(`\nEmpresa: ${empresa.razao_social}`)
console.log(`CNPJ: ${empresa.cnpj}`)
console.log(`ID: ${empresa.id}`)

// Buscar documentos de 12/2025
const { data: docs } = await supabase
  .from('fa_documentos_fiscais')
  .select('id, tipo_movimento, impacto_receita, valor_total, status, data_competencia')
  .eq('empresa_id', empresa.id)
  .eq('data_competencia', '12/2025')

console.log(`\n--- fa_documentos_fiscais (12/2025) ---`)
console.log(`Total documentos: ${docs?.length ?? 0}`)

if (docs?.length) {
  const impactoDist = docs.reduce((acc, d) => {
    const k = d.impacto_receita ?? 'null'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
  const tipoDist = docs.reduce((acc, d) => {
    const k = d.tipo_movimento ?? 'null'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
  const total = docs.reduce((s, d) => s + (d.valor_total ?? 0), 0)
  const totalSoma = docs.filter(d => d.impacto_receita === 'soma_receita').reduce((s, d) => s + (d.valor_total ?? 0), 0)

  console.log(`\nDistribuição impacto_receita:`)
  Object.entries(impactoDist).forEach(([k, v]) => console.log(`  ${k}: ${v} docs`))
  console.log(`\nDistribuição tipo_movimento:`)
  Object.entries(tipoDist).forEach(([k, v]) => console.log(`  ${k}: ${v} docs`))
  console.log(`\nValor total todos docs: R$ ${total.toFixed(2)}`)
  console.log(`Valor total soma_receita: R$ ${totalSoma.toFixed(2)}`)
}

console.log(`\n--- fa_arquivos_xml ---`)

// Contar total
const { count: totalXml } = await supabase
  .from('fa_arquivos_xml')
  .select('*', { count: 'exact', head: true })
  .eq('empresa_id', empresa.id)
console.log(`Total de XMLs da empresa (real): ${totalXml}`)

// Buscar apenas os de 12/2025 diretamente (sem limite de 1000)
const { data: dez2025, error: xmlErr } = await supabase
  .from('fa_arquivos_xml')
  .select('id, tipo_operacao, valor_total, status, data_emissao, competencia')
  .eq('empresa_id', empresa.id)
  .gte('data_emissao', '2025-12-01')
  .lt('data_emissao', '2026-01-01')

if (xmlErr) console.log('Erro:', xmlErr.message)

// Também buscar por competencia = '12/2025' (coluna separada)
const { data: dez2025comp } = await supabase
  .from('fa_arquivos_xml')
  .select('id, tipo_operacao, valor_total, status')
  .eq('empresa_id', empresa.id)
  .eq('competencia', '12/2025')

const porEmissao = dez2025 ?? []
const porComp = (dez2025comp ?? []).filter(x => !porEmissao.find(e => e.id === x.id))
const todos12 = [...porEmissao, ...porComp]

console.log(`XMLs com data_emissao em 12/2025: ${porEmissao.length}`)
console.log(`XMLs com competencia='12/2025' (extras): ${porComp.length}`)
console.log(`Total 12/2025: ${todos12.length}`)

if (todos12.length > 0) {
  const tipoDist = todos12.reduce((acc, x) => { const k = x.tipo_operacao ?? 'null'; acc[k] = (acc[k] ?? 0) + 1; return acc }, {})
  const statusDist = todos12.reduce((acc, x) => { const k = x.status ?? 'null'; acc[k] = (acc[k] ?? 0) + 1; return acc }, {})
  const totalValor = todos12.reduce((s, x) => s + (x.valor_total ?? 0), 0)
  const totalSaida = todos12.filter(x => x.tipo_operacao === 'saida').reduce((s, x) => s + (x.valor_total ?? 0), 0)
  console.log(`\nDistribuição tipo_operacao:`, tipoDist)
  console.log(`Distribuição status:`, statusDist)
  console.log(`Valor total todos: R$ ${totalValor.toFixed(2)}`)
  console.log(`Valor total saídas: R$ ${totalSaida.toFixed(2)}`)
} else {
  // Listar competências disponíveis (paginando)
  console.log(`\nNão há XMLs para 12/2025. Verificando datas disponíveis...`)
  const { data: recentes } = await supabase
    .from('fa_arquivos_xml')
    .select('data_emissao, competencia, tipo_operacao, valor_total')
    .eq('empresa_id', empresa.id)
    .order('data_emissao', { ascending: false })
    .limit(5)
  console.log(`5 XMLs mais recentes:`)
  recentes?.forEach(x => console.log(`  data_emissao: ${x.data_emissao} | competencia: ${x.competencia} | tipo: ${x.tipo_operacao} | valor: ${x.valor_total}`))
}
