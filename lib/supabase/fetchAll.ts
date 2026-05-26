/**
 * Busca todos os registros Supabase em lotes, eliminando tetos fixos de linhas.
 * Uso: await fetchAll((from, to) => supabase.from('tabela').select('*').range(from, to))
 */
export async function fetchAll<T>(
  queryBuilderFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  batchSize = 1000
): Promise<T[]> {
  const all: T[] = []
  let from = 0

  while (true) {
    const to = from + batchSize - 1
    const { data, error } = await queryBuilderFactory(from, to)

    if (error) throw error

    const batch = data ?? []
    all.push(...batch)

    if (batch.length < batchSize) break

    from += batchSize
  }

  return all
}
