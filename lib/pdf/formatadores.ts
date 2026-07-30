export function dataBr(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(data)
}

export function dataHoraBr(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(data)
}

export function dataBrDeIso(iso: string | null | undefined): string {
  if (!iso) return '-'
  const [ano, mes, dia] = iso.split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso
}

/**
 * Evita que textos malformados vindos de XMLs criem blocos maiores que uma
 * página no @react-pdf/renderer. Também remove controles que não devem ser
 * enviados ao fluxo de texto do PDF.
 */
export function textoPdfSeguro(valor: string | null | undefined, limite = 300): string {
  const texto = (valor ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!texto) return '-'
  if (texto.length <= limite) return texto
  return `${texto.slice(0, Math.max(0, limite - 1))}…`
}
