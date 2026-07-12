// Configuração institucional centralizada da Enfokus Contabilidade.
//
// Fonte única de verdade para qualquer documento institucional gerado pelo
// sistema (papel timbrado, relatórios em PDF, futuras comunicações). Nenhum
// componente ou template deve escrever esses dados diretamente — todos devem
// importar e ler daqui, para que uma correção futura (ex.: o CEP) não exija
// alterar o gerador do documento.
//
// Dados oficiais informados pelo usuário em 2026-07-12. Nada aqui foi
// deduzido, adivinhado ou copiado de versões antigas do sistema.

export interface EnderecoInstitucional {
  logradouro: string
  numero: string
  quadra: string
  lote: string
  sala: string
  bairro: string
  cidade: string
  estado: string
  /**
   * O CEP está PENDENTE de confirmação: foram informados dois CEPs
   * diferentes (74.275-220 e 74.250-280) e não é seguro escolher um deles
   * arbitrariamente. Enquanto `cep` for `null`, qualquer template deve
   * exibir o endereço sem CEP. Assim que o CEP correto for confirmado,
   * atualizar apenas este campo — nenhum outro arquivo precisa mudar.
   */
  cep: string | null
}

export interface ConfigInstitucionalEnfokus {
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  cnpjFormatado: string
  endereco: EnderecoInstitucional
  telefone: string
  telefoneFormatado: string
  /** Dígitos internacionais, sem símbolos — uso em links wa.me. */
  whatsapp: string
  site: string
  siteExibicao: string
  /** Caminho público (em /public) do logo principal, para uso em <Image> ou embutido no PDF. */
  logoPrincipal: string
  /**
   * Logo para fundos escuros, apenas se existir uma variante dedicada da
   * marca Enfokus CONTABILIDADE (não confundir com /logo-enfokus-white.png,
   * que é do produto Enfokus Sistemas — marca diferente, proibida neste
   * relatório). Nenhuma variante própria foi fornecida até o momento.
   */
  logoFundoEscuro: string | null
  cores: {
    primaria: string
    primariaEscura: string
    texto: string
    textoSuave: string
    fundo: string
  }
  /** Data em que este arquivo de configuração foi atualizado pela última vez. */
  atualizadoEm: string
}

export const ENFOKUS_CONTABILIDADE: ConfigInstitucionalEnfokus = {
  razaoSocial: 'Enfokus Contábil LTDA - ME',
  nomeFantasia: 'Enfokus Contabilidade',
  cnpj: '29691723000166',
  cnpjFormatado: '29.691.723/0001-66',
  endereco: {
    logradouro: 'R. C-253',
    numero: '184',
    quadra: '458',
    lote: '08',
    sala: '01',
    bairro: 'Jardim América',
    cidade: 'Goiânia',
    estado: 'GO',
    cep: null, // PENDENTE — ver EnderecoInstitucional.cep
  },
  telefone: '62982011191',
  telefoneFormatado: '(62) 9 8201-1191',
  whatsapp: '5562982011191',
  site: 'https://www.enfokus.com.br',
  siteExibicao: 'www.enfokus.com.br',
  logoPrincipal: '/logo-enfokus-contabilidade.png',
  logoFundoEscuro: null,
  cores: {
    primaria: '#27c7d8',
    primariaEscura: '#0e8a96',
    texto: '#12202c',
    textoSuave: '#4b5c68',
    fundo: '#ffffff',
  },
  atualizadoEm: '2026-07-12',
}

/** Endereço formatado em uma linha, sem CEP enquanto ele estiver pendente de confirmação. */
export function enderecoInstitucionalLinha(cfg: ConfigInstitucionalEnfokus = ENFOKUS_CONTABILIDADE): string {
  const e = cfg.endereco
  const partes = [
    `${e.logradouro}, nº ${e.numero}`,
    `Quadra ${e.quadra}, Lote ${e.lote}, Sala ${e.sala}`,
    e.bairro,
    `${e.cidade} - ${e.estado}`,
  ]
  if (e.cep) partes.push(`CEP ${e.cep}`)
  return partes.join(', ')
}

/** Versão curta para rodapé (2 segmentos), sem CEP enquanto pendente. */
export function enderecoInstitucionalResumido(cfg: ConfigInstitucionalEnfokus = ENFOKUS_CONTABILIDADE): string {
  const e = cfg.endereco
  const linha = `${e.logradouro}, nº ${e.numero}, Qd. ${e.quadra}, Lt. ${e.lote}, Sala ${e.sala}, ${e.bairro}, ${e.cidade} - ${e.estado}`
  return e.cep ? `${linha}, CEP ${e.cep}` : linha
}

export function linkWhatsapp(mensagem: string, cfg: ConfigInstitucionalEnfokus = ENFOKUS_CONTABILIDADE): string {
  return `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(mensagem)}`
}
