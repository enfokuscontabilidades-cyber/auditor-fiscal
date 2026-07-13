// Sniff de tipo real de imagem por magic bytes — nunca confiar apenas na
// extensão do arquivo ou no Content-Type informado pelo navegador.

export type TipoImagemDetectado = 'png' | 'jpeg' | 'webp'

export function detectarTipoImagem(bytes: Uint8Array): TipoImagemDetectado | null {
  if (bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return 'png'
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg'
  }

  if (bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'webp'
  }

  return null
}

export const EXTENSAO_POR_TIPO: Record<TipoImagemDetectado, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
}

export const MIME_POR_TIPO: Record<TipoImagemDetectado, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export const LOGO_TAMANHO_MAXIMO_BYTES = 2 * 1024 * 1024 // 2MB — o cliente já redimensiona antes do upload
