import type { NcmHierarquiaItem } from './ncm'

export interface RegistroNcmHierarquia {
  codigo: string
  descricao: string
}

interface SecaoNcm {
  numero: string
  capituloInicio: number
  capituloFim: number
  descricao: string
}

const SECOES_NCM: SecaoNcm[] = [
  { numero: 'I', capituloInicio: 1, capituloFim: 5, descricao: 'Animais vivos e produtos do reino animal' },
  { numero: 'II', capituloInicio: 6, capituloFim: 14, descricao: 'Produtos do reino vegetal' },
  { numero: 'III', capituloInicio: 15, capituloFim: 15, descricao: 'Gorduras e óleos animais, vegetais ou de origem microbiana e produtos da sua dissociação; gorduras alimentícias elaboradas; ceras de origem animal ou vegetal' },
  { numero: 'IV', capituloInicio: 16, capituloFim: 24, descricao: 'Produtos das indústrias alimentares; bebidas, líquidos alcoólicos e vinagres; tabaco e seus sucedâneos manufaturados; produtos, mesmo com nicotina, destinados à inalação sem combustão; outros produtos que contenham nicotina destinados à absorção da nicotina pelo corpo humano' },
  { numero: 'V', capituloInicio: 25, capituloFim: 27, descricao: 'Produtos minerais' },
  { numero: 'VI', capituloInicio: 28, capituloFim: 38, descricao: 'Produtos das indústrias químicas ou das indústrias conexas' },
  { numero: 'VII', capituloInicio: 39, capituloFim: 40, descricao: 'Plásticos e suas obras; borracha e suas obras' },
  { numero: 'VIII', capituloInicio: 41, capituloFim: 43, descricao: 'Peles, couros, peles com pelo e obras destas matérias; artigos de correeiro ou de seleiro; artigos de viagem, bolsas e artefatos semelhantes; obras de tripa' },
  { numero: 'IX', capituloInicio: 44, capituloFim: 46, descricao: 'Madeira, carvão vegetal e obras de madeira; cortiça e suas obras; obras de espartaria ou de cestaria' },
  { numero: 'X', capituloInicio: 47, capituloFim: 49, descricao: 'Pastas de madeira ou de outras matérias fibrosas celulósicas; papel ou cartão para reciclar (desperdícios e aparas); papel ou cartão e suas obras' },
  { numero: 'XI', capituloInicio: 50, capituloFim: 63, descricao: 'Matérias têxteis e suas obras' },
  { numero: 'XII', capituloInicio: 64, capituloFim: 67, descricao: 'Calçado, chapéus e artigos de uso semelhante, guarda-chuvas, guarda-sóis, bengalas, chicotes e suas partes; penas preparadas e suas obras; flores artificiais; obras de cabelo' },
  { numero: 'XIII', capituloInicio: 68, capituloFim: 70, descricao: 'Obras de pedra, gesso, cimento, amianto, mica ou de matérias semelhantes; produtos cerâmicos; vidro e suas obras' },
  { numero: 'XIV', capituloInicio: 71, capituloFim: 71, descricao: 'Pérolas naturais ou cultivadas, pedras preciosas ou semipreciosas e semelhantes, metais preciosos, metais folheados ou chapeados de metais preciosos (plaquê) e suas obras; bijuterias; moedas' },
  { numero: 'XV', capituloInicio: 72, capituloFim: 83, descricao: 'Metais comuns e suas obras' },
  { numero: 'XVI', capituloInicio: 84, capituloFim: 85, descricao: 'Máquinas e aparelhos, material elétrico e suas partes; aparelhos de gravação ou de reprodução de som, aparelhos de gravação ou de reprodução de imagens e de som em televisão, e suas partes e acessórios' },
  { numero: 'XVII', capituloInicio: 86, capituloFim: 89, descricao: 'Material de transporte' },
  { numero: 'XVIII', capituloInicio: 90, capituloFim: 92, descricao: 'Instrumentos e aparelhos de óptica, fotografia, cinematografia, medida, controle ou precisão; instrumentos médico-cirúrgicos; aparelhos de relojoaria; instrumentos musicais; suas partes e acessórios' },
  { numero: 'XIX', capituloInicio: 93, capituloFim: 93, descricao: 'Armas e munições; suas partes e acessórios' },
  { numero: 'XX', capituloInicio: 94, capituloFim: 96, descricao: 'Mercadorias e produtos diversos' },
  { numero: 'XXI', capituloInicio: 97, capituloFim: 97, descricao: 'Objetos de arte, de coleção e antiguidades' },
]

function codigoNumerico(valor: string): string {
  return String(valor ?? '').replace(/\D/g, '')
}

export function limparDescricaoNcm(valor: string): string {
  return valor
    .replace(/<[^>]*>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/^\s*[-–—]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function secaoDoNcm(codigo: string): NcmHierarquiaItem | null {
  const capitulo = Number(codigo.slice(0, 2))
  if (!Number.isInteger(capitulo)) return null
  const secao = SECOES_NCM.find(item => capitulo >= item.capituloInicio && capitulo <= item.capituloFim)
  return secao ? { nivel: 'secao', codigo: secao.numero, descricao: secao.descricao } : null
}

export function montarHierarquiaNcm(
  registros: RegistroNcmHierarquia[],
  codigoInformado: string,
): NcmHierarquiaItem[] {
  const codigo = codigoNumerico(codigoInformado).slice(0, 8)
  if (codigo.length !== 8) return []

  const porCodigo = new Map<string, RegistroNcmHierarquia>()
  for (const registro of registros) {
    const chave = codigoNumerico(registro.codigo)
    if (chave && !porCodigo.has(chave)) porCodigo.set(chave, registro)
  }

  const hierarquia: NcmHierarquiaItem[] = []
  const secao = secaoDoNcm(codigo)
  if (secao) hierarquia.push(secao)

  const niveis: Array<{ tamanho: number; nivel: NcmHierarquiaItem['nivel'] }> = [
    { tamanho: 2, nivel: 'capitulo' },
    { tamanho: 4, nivel: 'posicao' },
    { tamanho: 5, nivel: 'subposicao' },
    { tamanho: 6, nivel: 'subposicao' },
    { tamanho: 7, nivel: 'item' },
  ]

  for (const { tamanho, nivel } of niveis) {
    const registro = porCodigo.get(codigo.slice(0, tamanho))
    if (!registro) continue
    hierarquia.push({
      nivel,
      codigo: registro.codigo,
      descricao: limparDescricaoNcm(registro.descricao),
    })
  }

  return hierarquia
}
