// Validação e formatação de CNPJ/telefone para formulários públicos.
// Independente das cópias locais usadas em ModalCnpj.tsx / useEmpresaAtiva.ts
// para não acoplar a isca digital ao restante do sistema autenticado.

export function somenteDigitos(valor: string): string {
  return (valor || '').replace(/\D/g, '')
}

/** Valida CNPJ (14 dígitos) incluindo os dois dígitos verificadores. */
export function validarCnpj(valor: string): boolean {
  const cnpj = somenteDigitos(valor)
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  function digitoVerificador(base: string): number {
    const pesos = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = base.split('').reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const base12 = cnpj.slice(0, 12)
  const dv1 = digitoVerificador(base12)
  const dv2 = digitoVerificador(base12 + String(dv1))
  return cnpj === base12 + String(dv1) + String(dv2)
}

export function formatarCnpj(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 14)
  const partes = [
    d.slice(0, 2),
    d.slice(2, 5),
    d.slice(5, 8),
    d.slice(8, 12),
    d.slice(12, 14),
  ]
  let resultado = partes[0]
  if (partes[1]) resultado += `.${partes[1]}`
  if (partes[2]) resultado += `.${partes[2]}`
  if (partes[3]) resultado += `/${partes[3]}`
  if (partes[4]) resultado += `-${partes[4]}`
  return resultado
}

// Mascara o CNPJ mantendo apenas raiz e dígitos finais visíveis (ex: 12.345.***-**-67).
export function mascararCnpjParcial(valor: string): string {
  const d = somenteDigitos(valor)
  if (d.length !== 14) return formatarCnpj(valor)
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.***/****-${d.slice(12, 14)}`
}

export function formatarTelefoneBr(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function telefoneValido(valor: string): boolean {
  const d = somenteDigitos(valor)
  return d.length === 10 || d.length === 11
}

export function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((valor || '').trim())
}
