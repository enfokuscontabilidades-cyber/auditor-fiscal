// Wrapper mínimo de eventos de conversão para páginas públicas.
// Envia para window.dataLayer (padrão GTM) quando disponível; vira no-op
// silencioso caso nenhuma ferramenta de analytics esteja instalada.
// Nunca inclua PII (nome, e-mail, telefone, CNPJ, dados do XML) no payload.

declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

export type EventoDiagnosticoReforma =
  | 'reforma_pageview'
  | 'reforma_clique_cta_principal'
  | 'reforma_formulario_iniciado'
  | 'reforma_formulario_concluido'
  | 'reforma_formulario_erro'
  | 'reforma_lead_gravado'
  | 'reforma_upload_iniciado'
  | 'reforma_upload_erro'
  | 'reforma_xml_analisado'
  | 'reforma_resultado_positivo'
  | 'reforma_resultado_atencao'
  | 'reforma_resultado_critico'
  | 'reforma_clique_whatsapp'
  | 'reforma_clique_plano_pago'
  | 'reforma_nova_analise'
  | 'reforma_pdf_solicitado'
  | 'reforma_pdf_gerado'
  | 'reforma_pdf_erro'

type EventoMetadata = Record<string, string | number | boolean | undefined>

export function rastrearEvento(evento: EventoDiagnosticoReforma, metadata?: EventoMetadata) {
  if (typeof window === 'undefined') return
  try {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event: evento, ...metadata })
  } catch {
    // analytics nunca deve quebrar a página pública
  }
}
