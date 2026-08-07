import { describe, expect, test } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrgId, OrgMembershipConflictError } from '@/lib/supabase/org'

function clientWithMemberships(rows: { org_id: string }[], error: Error | null = null): SupabaseClient {
  const query = {
    select: () => query,
    eq: () => query,
    limit: async () => ({ data: rows, error }),
  }

  return {
    from: () => query,
  } as unknown as SupabaseClient
}

describe('resolução da organização do usuário', () => {
  test('retorna null quando o usuário ainda não possui escritório', async () => {
    await expect(getOrgId(clientWithMemberships([]), 'user-1')).resolves.toBeNull()
  })

  test('retorna o único escritório vinculado', async () => {
    await expect(getOrgId(clientWithMemberships([{ org_id: 'org-1' }]), 'user-1')).resolves.toBe('org-1')
  })

  test('nunca escolhe silenciosamente entre dois escritórios', async () => {
    await expect(getOrgId(clientWithMemberships([
      { org_id: 'org-1' },
      { org_id: 'org-2' },
    ]), 'user-1')).rejects.toBeInstanceOf(OrgMembershipConflictError)
  })

  test('propaga falhas do banco', async () => {
    await expect(getOrgId(clientWithMemberships([], new Error('database unavailable')), 'user-1'))
      .rejects.toThrow('database unavailable')
  })
})

