/**
 * Busca todos os registros Supabase em lotes, eliminando tetos fixos de linhas.
 * Uso: await fetchAll((from, to) => supabase.from('tabela').select('*').range(from, to))
 */
export function isRangeNotSatisfiable(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const record = error as { code?: unknown; message?: unknown; details?: unknown }
  const code = typeof record.code === 'string' ? record.code : ''
  const text = [record.message, record.details, record.code]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()

  return code === 'PGRST103' || text.includes('requested range not satisfiable')
}

export async function fetchAll<T>(
  queryBuilderFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  batchSize = 1000
): Promise<T[]> {
  const all: T[] = []
  let from = 0

  while (true) {
    const to = from + batchSize - 1
    const { data, error } = await queryBuilderFactory(from, to)

    if (error) {
      if (isRangeNotSatisfiable(error)) break
      throw error
    }

    const batch = data ?? []
    all.push(...batch)

    if (batch.length < batchSize) break

    from += batchSize
  }

  return all
}
