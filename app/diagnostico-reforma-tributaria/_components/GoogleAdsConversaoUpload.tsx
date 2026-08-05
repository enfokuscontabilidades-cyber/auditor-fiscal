'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

const GOOGLE_ADS_ID = 'AW-18305830646'
const CONVERSAO_UPLOAD = 'AW-18305830646/osUmCKqPydwcEPad85hE'
const HOST_PERMITIDO = 'auditor.enfokus.com.br'
const ROTA_PERMITIDA = '/diagnostico-reforma-tributaria'

type JanelaGoogleAds = Window & {
  dataLayer?: unknown[][]
  gtag?: (...args: unknown[]) => void
  __googleAdsConversaoUploadConfigurado?: boolean
}

export default function GoogleAdsConversaoUpload() {
  const [paginaPermitida, setPaginaPermitida] = useState(false)

  useEffect(() => {
    const host = window.location.hostname.replace(/^www\./, '')
    const path = window.location.pathname.replace(/\/+$/, '') || '/'

    if (host !== HOST_PERMITIDO || path !== ROTA_PERMITIDA) return

    const janela = window as JanelaGoogleAds
    janela.dataLayer = janela.dataLayer || []
    janela.gtag = janela.gtag || ((...args: unknown[]) => janela.dataLayer?.push(args))

    if (!janela.__googleAdsConversaoUploadConfigurado) {
      janela.gtag('js', new Date())
      janela.gtag('config', GOOGLE_ADS_ID)
      janela.__googleAdsConversaoUploadConfigurado = true
    }

    setPaginaPermitida(true)

    function registrarConversao(event: MouseEvent) {
      if (!(event.target instanceof Element)) return

      const button = event.target.closest('button')
      if (!button) return

      const texto = (button.innerText || button.textContent || '').trim().toLowerCase()
      if (!texto.includes('continuar para o upload')) return

      janela.gtag?.('event', 'conversion', { send_to: CONVERSAO_UPLOAD })
    }

    document.addEventListener('click', registrarConversao, true)
    return () => document.removeEventListener('click', registrarConversao, true)
  }, [])

  if (!paginaPermitida) return null

  return (
    <Script
      id="google-ads-conversao-upload"
      src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
      strategy="afterInteractive"
    />
  )
}
