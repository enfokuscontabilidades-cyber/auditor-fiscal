// Redimensionamento proporcional da logo do escritório, sempre executado
// no navegador antes do upload. Converte qualquer formato aceito para PNG
// via canvas — preserva transparência, nunca estica/achata (contain, não
// cover) e nunca amplia uma imagem menor que a caixa máxima.

const MAX_LARGURA = 480
const MAX_ALTURA = 180

export async function redimensionarLogoParaPng(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const escala = Math.min(MAX_LARGURA / bitmap.width, MAX_ALTURA / bitmap.height, 1)
    const largura = Math.max(1, Math.round(bitmap.width * escala))
    const altura = Math.max(1, Math.round(bitmap.height * escala))

    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.')
    ctx.clearRect(0, 0, largura, altura)
    ctx.drawImage(bitmap, 0, 0, largura, altura)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem redimensionada.'))), 'image/png')
    })
  } finally {
    bitmap.close()
  }
}
