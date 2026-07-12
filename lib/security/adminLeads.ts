// Controle de acesso à área administrativa dos leads comerciais da Enfokus
// Contabilidade (funil de captação da própria plataforma). Esses leads não
// pertencem a nenhuma organização cliente — não existe hoje, no modelo
// multi-tenant do projeto, o conceito de "organização dona da plataforma".
// Por isso o acesso é controlado por uma allowlist de e-mails via variável
// de ambiente, e não pelo papel do usuário dentro do seu próprio escritório.

export function emailAutorizadoParaLeads(email: string | null | undefined): boolean {
  if (!email) return false
  const lista = (process.env.LEADS_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return lista.includes(email.trim().toLowerCase())
}
