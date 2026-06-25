import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const VENDA_COMERCIO = new Set([
  '5101','5102','5111','5113','5114','5115','5116','5117','5118','5119',
  '6101','6102','6111','6113','6114','6115','6116','6117','6118','6119',
  '5120','5122','5123','5124','5125','6120','6122','6123','6124','6125',
])
const VENDA_ST = new Set([
  '5401','5402','5403','5405','5500','5501','5502','5503','5504',
  '6401','6402','6403','6404','6405','6500','6501','6502','6503','6504',
])
const SERVICO = new Set(['5301','5302','5303','5304','5305','5306','5307','5308','5309','6301','6302','6303','6304','6305','6306','6307','6308','6309'])
const EXPORTACAO = new Set(['7101','7102','7105','7106','7127','7201','7202','7203','7205','7206','7208','7210','7211','7301','7302','7303','7304','7305','7306','7401','7501','7651','7652','7654','7667','7930'])
const DEVOLUCAO_VENDA = new Set(['1201','1202','1203','1204','1209','1410','1411','2201','2202','2203','2204','2209','2410','2411'])
const DEVOLUCAO_COMPRA = new Set(['5201','5202','5203','5204','5205','5206','5207','5208','5209','5210','6201','6202','6203','6204','6205','6206','6207','6208','6209','6210'])
const REMESSA = new Set([
  '5601','5602','5603','5604','5605','5606','5607','6601','6602','6603','6604','6605','6606','6607',
  '5901','5902','5903','5904','5905','5906','5907','5908','5909','5910','5911','5912','5913','5914','5915','5916',
  '6901','6902','6903','6904','6905','6906','6907','6908','6909','6910','6911','6912','6913','6914','6915','6916',
  '5501','5502','5503','5504','5505','6501','6502','6503','6504','6505',
])
const TRANSFERENCIA = new Set(['5151','5152','5153','5154','5155','5156','6151','6152','6153','6154','6155','6156','1151','1152','1153','1154','1155','1156','2151','2152','2153','2154','2155','2156'])

const args = process.argv.slice(2)
const pasta = path.resolve(args[0] ?? 'xml-01-2025')
const receitaPgdas = Number.parseFloat(args.find(arg => arg.startsWith('--pgdas='))?.split('=')[1]?.replace(/\./g, '').replace(',', '.') ?? 'NaN')
const saida = path.resolve(args.find(arg => arg.startsWith('--out='))?.split('=')[1] ?? 'tmp/auditoria-xml-01-2025')

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return match?.[1]?.trim() ?? ''
}

function tags(xml, name) {
  return [...xml.matchAll(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'gi'))].map(match => match[1])
}

function numero(value) {
  if (!value) return 0
  const n = Number.parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function classificar(cfop, tpNF) {
  const c = cfop.replace(/\D/g, '').slice(0, 4)
  if (DEVOLUCAO_VENDA.has(c)) return 'devolucao_venda'
  if (DEVOLUCAO_COMPRA.has(c) || REMESSA.has(c) || TRANSFERENCIA.has(c)) return 'sem_impacto'
  if (tpNF !== '1') return 'sem_impacto'
  if (VENDA_COMERCIO.has(c) || VENDA_ST.has(c) || SERVICO.has(c) || EXPORTACAO.has(c)) return 'faturamento'
  if (c.startsWith('5') || c.startsWith('6') || c.startsWith('7')) return 'pendente'
  return 'sem_impacto'
}

function csv(rows) {
  return rows.map(row => row.map(value => {
    const text = String(value ?? '')
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }).join(';')).join('\n')
}

function brl(value) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

await mkdir(saida, { recursive: true })

const arquivos = (await readdir(pasta, { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.xml'))

const canceladas = new Set()
const documentos = new Map()
const duplicadas = []
const erros = []

for (const entry of arquivos) {
  const full = path.join(entry.parentPath ?? pasta, entry.name)
  const xml = await readFile(full, 'utf8')
  const tpEvento = tag(xml, 'tpEvento')
  const chaveEvento = tag(xml, 'chNFe')

  if (tpEvento === '110111' && chaveEvento) {
    canceladas.add(chaveEvento)
    continue
  }

  const infNFe = tag(xml, 'infNFe')
  if (!infNFe) continue

  const id = infNFe.match(/Id="NFe(\d{44})"/)?.[1] ?? tag(xml, 'chNFe')
  if (!id) {
    erros.push([entry.name, 'sem chave'])
    continue
  }
  if (documentos.has(id)) {
    duplicadas.push([id, entry.name])
    continue
  }

  const ide = tag(xml, 'ide')
  const emit = tag(xml, 'emit')
  const dest = tag(xml, 'dest')
  const total = tag(xml, 'ICMSTot')
  const tpNF = tag(ide, 'tpNF')
  const itens = tags(xml, 'det').map((det, index) => {
    const prod = tag(det, 'prod')
    const cfop = tag(prod, 'CFOP')
    const vProd = numero(tag(prod, 'vProd'))
    const vDesc = numero(tag(prod, 'vDesc'))
    const valor = Math.max(0, vProd - vDesc)
    const impacto = classificar(cfop, tpNF)
    return {
      item: index + 1,
      cfop,
      descricao: tag(prod, 'xProd'),
      ncm: tag(prod, 'NCM'),
      valor,
      impacto,
    }
  })

  documentos.set(id, {
    chave: id,
    numero: tag(ide, 'nNF'),
    data: tag(ide, 'dhEmi') || tag(ide, 'dEmi'),
    tpNF,
    emitente: tag(emit, 'xNome'),
    destinatario: tag(dest, 'xNome'),
    vNF: numero(tag(total, 'vNF')),
    itens,
  })
}

const docsValidos = [...documentos.values()].filter(doc => !canceladas.has(doc.chave))
const linhasItens = []
const porCfop = new Map()
const porNota = []
let faturamento = 0
let devolucao = 0
let semImpacto = 0
let pendente = 0

for (const doc of docsValidos) {
  let valorFaturamentoNota = 0
  for (const item of doc.itens) {
    const atual = porCfop.get(item.cfop) ?? { cfop: item.cfop, faturamento: 0, devolucao: 0, semImpacto: 0, pendente: 0, itens: 0 }
    if (item.impacto === 'faturamento') {
      faturamento += item.valor
      valorFaturamentoNota += item.valor
      atual.faturamento += item.valor
    } else if (item.impacto === 'devolucao_venda') {
      devolucao += item.valor
      atual.devolucao += item.valor
    } else if (item.impacto === 'pendente') {
      pendente += item.valor
      atual.pendente += item.valor
    } else {
      semImpacto += item.valor
      atual.semImpacto += item.valor
    }
    atual.itens++
    porCfop.set(item.cfop, atual)
    linhasItens.push([doc.chave, doc.numero, doc.data, doc.destinatario, item.item, item.cfop, item.ncm, item.descricao, item.impacto, brl(item.valor)])
  }
  if (valorFaturamentoNota > 0) {
    porNota.push([doc.chave, doc.numero, doc.data, doc.destinatario, brl(valorFaturamentoNota)])
  }
}

const liquido = faturamento - devolucao
const resumo = [
  ['Metrica', 'Valor'],
  ['Arquivos XML lidos', arquivos.length],
  ['Documentos NF-e unicos', documentos.size],
  ['Eventos de cancelamento', canceladas.size],
  ['Documentos validos apos cancelamento', docsValidos.length],
  ['Faturamento XML', brl(faturamento)],
  ['Devolucoes de venda', brl(devolucao)],
  ['Faturamento liquido XML', brl(liquido)],
  ['Saidas sem impacto', brl(semImpacto)],
  ['CFOP pendente de revisao', brl(pendente)],
]
if (Number.isFinite(receitaPgdas)) {
  resumo.push(['Receita PGDAS-D informada', brl(receitaPgdas)])
  resumo.push(['Diferenca XML - PGDAS-D', brl(liquido - receitaPgdas)])
}

await writeFile(path.join(saida, 'resumo.csv'), csv(resumo), 'utf8')
await writeFile(path.join(saida, 'por-cfop.csv'), csv([
  ['CFOP', 'Itens', 'Faturamento', 'Devolucao', 'Sem impacto', 'Pendente'],
  ...[...porCfop.values()]
    .sort((a, b) => (b.faturamento - b.devolucao) - (a.faturamento - a.devolucao))
    .map(row => [row.cfop, row.itens, brl(row.faturamento), brl(row.devolucao), brl(row.semImpacto), brl(row.pendente)]),
]), 'utf8')
await writeFile(path.join(saida, 'itens.csv'), csv([
  ['Chave', 'Nota', 'Data', 'Participante', 'Item', 'CFOP', 'NCM', 'Descricao', 'Impacto', 'Valor'],
  ...linhasItens,
]), 'utf8')
await writeFile(path.join(saida, 'notas-faturamento.csv'), csv([
  ['Chave', 'Nota', 'Data', 'Participante', 'Valor faturamento'],
  ...porNota.sort((a, b) => Number.parseFloat(String(b[4]).replace(/\./g, '').replace(',', '.')) - Number.parseFloat(String(a[4]).replace(/\./g, '').replace(',', '.'))),
]), 'utf8')
await writeFile(path.join(saida, 'canceladas.csv'), csv([
  ['Chave cancelada'],
  ...[...canceladas].map(chave => [chave]),
]), 'utf8')
await writeFile(path.join(saida, 'duplicadas.csv'), csv([
  ['Chave', 'Arquivo duplicado'],
  ...duplicadas,
]), 'utf8')
await writeFile(path.join(saida, 'erros.csv'), csv([
  ['Arquivo', 'Erro'],
  ...erros,
]), 'utf8')

console.log(`Arquivos XML lidos: ${arquivos.length}`)
console.log(`Documentos validos: ${docsValidos.length}`)
console.log(`Faturamento XML: R$ ${brl(faturamento)}`)
console.log(`Devolucoes: R$ ${brl(devolucao)}`)
console.log(`Faturamento liquido XML: R$ ${brl(liquido)}`)
if (Number.isFinite(receitaPgdas)) console.log(`Diferenca XML - PGDAS-D: R$ ${brl(liquido - receitaPgdas)}`)
console.log(`Relatorios gerados em: ${saida}`)
