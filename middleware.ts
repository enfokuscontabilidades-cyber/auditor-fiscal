import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Prefixos de API exclusivos da plataforma completa — nunca usados pelos
// fluxos do produto "somente Reforma Tributária" (dashboard restrito,
// empresas, /reforma_tributaria, /assinatura). Reforça no backend o mesmo
// bloqueio que app/(fiscal)/(full-platform)/layout.tsx já faz nas páginas,
// para que uma chamada manual de API não contorne o gate de módulo.
const FULL_PLATFORM_ONLY_API_PREFIXES = [
  '/api/arquivos-sped',
  '/api/simples_nacional',
  '/api/simples/',
  '/api/planejamento-tributario',
  '/api/alertas',
  '/api/documentos-fiscais/itens',
  '/api/relatorios/',
  '/api/sessoes',
  '/api/fiscal/',
  '/api/cobrancas',
  '/api/leads-reforma-tributaria',
]

function isFullPlatformOnlyApi(pathname: string): boolean {
  if (pathname === '/api/documentos-fiscais/importar') return true
  return FULL_PLATFORM_ONLY_API_PREFIXES.some(prefixo => pathname.startsWith(prefixo))
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/landing') ||
    pathname.startsWith('/diagnostico-reforma-tributaria') ||
    pathname.startsWith('/privacidade') ||
    pathname.startsWith('/termos') ||
    pathname.startsWith('/cadastro') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/planos-reforma-tributaria') ||
    pathname === '/api/leads/reforma-tributaria' ||
    pathname === '/api/leads/acesso-antecipado' ||
    pathname === '/api/diagnostico-reforma-tributaria/analisar' ||
    pathname.startsWith('/api/diagnostico-reforma-tributaria/relatorio/') ||
    pathname === '/api/stripe/webhook' ||
    pathname === '/api/planos' ||
    pathname.startsWith('/_next/')
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Sem env vars: rota pública passa, protegida vai para login
  if (!supabaseUrl || !supabaseKey) {
    if (isPublicPath(pathname)) return NextResponse.next({ request })
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof supabaseResponse.cookies.set>[2] }[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user && !isPublicPath(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    if (user && pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    if (user && isFullPlatformOnlyApi(pathname)) {
      const { data: membro } = await supabase
        .from('membros_organizacao')
        .select('organizacao:organizacoes(produto_escopo)')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      const org = membro?.organizacao as { produto_escopo?: string } | { produto_escopo?: string }[] | null
      const produtoEscopo = Array.isArray(org) ? org[0]?.produto_escopo : org?.produto_escopo
      if (produtoEscopo === 'tax_reform_only') {
        return NextResponse.json({ error: 'Módulo não disponível no seu plano.' }, { status: 403 })
      }
    }

    return supabaseResponse
  } catch {
    // Se o Supabase lançar exceção (rede, token malformado, etc.),
    // rotas públicas passam; rotas protegidas vão para login.
    if (isPublicPath(pathname)) return NextResponse.next({ request })
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
