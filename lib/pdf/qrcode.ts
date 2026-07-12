import QRCode from 'qrcode'

/** Gera um QR Code como data URI PNG (base64), pronto para uso em <Image src=.../>. */
export async function gerarQrCodeDataUri(conteudo: string): Promise<string> {
  return QRCode.toDataURL(conteudo, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
}
