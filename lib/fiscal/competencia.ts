export function normalizarCompetencia(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d{2}\/\d{4}$/.test(trimmed)) return trimmed
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const [ano, mes] = trimmed.split('-')
    return `${mes}/${ano}`
  }
  return trimmed
}

export function competenciaKey(value: string | null | undefined): number {
  const comp = normalizarCompetencia(value)
  if (!comp) return 0
  const match = comp.match(/^(\d{2})\/(\d{4})$/)
  if (!match) return 0
  return Number(match[2]) * 100 + Number(match[1])
}

export function competenciaNoPeriodo(
  competencia: string | null | undefined,
  inicio: string | null | undefined,
  fim: string | null | undefined,
): boolean {
  const comp = normalizarCompetencia(competencia)
  if (!comp) return false

  const key = competenciaKey(comp)
  const inicioKey = inicio ? competenciaKey(inicio) : null
  const fimKey = fim ? competenciaKey(fim) : null

  if (inicioKey !== null && key < inicioKey) return false
  if (fimKey !== null && key > fimKey) return false
  return true
}

export function competenciasEntre(
  inicio: string | null | undefined,
  fim: string | null | undefined,
): string[] {
  const inicioRaw = normalizarCompetencia(inicio)
  const fimRaw = normalizarCompetencia(fim)
  const inicioNorm = inicioRaw ?? fimRaw
  const fimNorm = fimRaw ?? inicioRaw
  if (!inicioNorm || !fimNorm) return []

  const ini = inicioNorm.match(/^(\d{2})\/(\d{4})$/)
  const end = fimNorm.match(/^(\d{2})\/(\d{4})$/)
  if (!ini || !end) return []

  let mes = Number(ini[1])
  let ano = Number(ini[2])
  const fimMes = Number(end[1])
  const fimAno = Number(end[2])
  const resultado: string[] = []

  while (ano < fimAno || (ano === fimAno && mes <= fimMes)) {
    resultado.push(`${String(mes).padStart(2, '0')}/${ano}`)
    mes++
    if (mes > 12) {
      mes = 1
      ano++
    }
  }

  return resultado
}
