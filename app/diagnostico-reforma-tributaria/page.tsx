import type { Metadata } from 'next'
import PaginaDiagnostico from './_components/PaginaDiagnostico'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://auditor.enfokus.com.br').replace(/\/$/, '')
const ROTA = '/diagnostico-reforma-tributaria'
const TITULO = 'Verifique seu XML para IBS e CBS | Enfokus Contabilidade'
const DESCRICAO = 'Envie um XML e verifique gratuitamente se o documento possui os novos campos de IBS e CBS da Reforma Tributária. Diagnóstico disponibilizado pela Enfokus Contabilidade.'

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  alternates: { canonical: `${APP_URL}${ROTA}` },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITULO,
    description: DESCRICAO,
    url: `${APP_URL}${ROTA}`,
    siteName: 'Enfokus Contabilidade',
    images: [{ url: `${APP_URL}/logo-enfokus-contabilidade.png`, width: 864, height: 289, alt: 'Enfokus Contabilidade' }],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRICAO,
    images: [`${APP_URL}/logo-enfokus-contabilidade.png`],
  },
}

export default function DiagnosticoReformaTributariaPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Diagnóstico gratuito de IBS e CBS em notas fiscais',
    provider: {
      '@type': 'AccountingService',
      name: 'Enfokus Contabilidade',
    },
    areaServed: 'BR',
    description: DESCRICAO,
    url: `${APP_URL}${ROTA}`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PaginaDiagnostico />
    </>
  )
}
