'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Páginas que não exigem verificação de sessão ativa
const PAGINAS_PUBLICAS = ['/login', '/cadastro', '/aguardando-ativacao', '/configuracoes/novo-escritorio', '/landing', '/diagnostico-reforma-tributaria', '/planos-reforma-tributaria', '/privacidade', '/termos']

export function SessionGuard() {
  const pathname = usePathname()

  useEffect(() => {
    if (PAGINAS_PUBLICAS.some(p => pathname.startsWith(p))) return

    const sessionActive = sessionStorage.getItem('session_active')
    const stayLoggedIn = localStorage.getItem('stay_logged_in')

    if (!sessionActive && !stayLoggedIn) {
      // Navegador foi fechado e usuário não marcou "Continuar logado"
      const supabase = createClient()
      supabase.auth.signOut().then(() => {
        window.location.href = '/login'
      })
    } else {
      sessionStorage.setItem('session_active', '1')
    }
  }, [pathname])

  return null
}
