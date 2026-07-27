export type NfseParaValorFiscal = {
  valorServicos: number
  status?: string
}

/**
 * Receita/valor contábil da NFS-e é o valor bruto dos serviços.
 * ISS e demais retenções afetam o líquido financeiro, não a receita bruta.
 */
export function valorFiscalNfse(nfse: NfseParaValorFiscal): number {
  if (nfse.status === 'cancelada') return 0
  const valor = Number(nfse.valorServicos)
  return Number.isFinite(valor) ? valor : 0
}
