/**
 * Prepara uma foto antes do envio: converte para JPEG e reduz para no máximo
 * `maxDim` px no maior lado. Resolve dois problemas reais vistos no painel:
 *  - foto do iPhone em HEIC (a leitura da carteirinha por IA não aceita HEIC);
 *  - foto grande demais (10+ MB) que falhava no envio pela rede do celular.
 * Se algo der errado, devolve o arquivo original (nunca piora a situação).
 */
export async function prepareImage(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  try {
    const isImage = file.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)
    if (!isImage || typeof document === 'undefined') return file
    const bitmap = await decode(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h)
    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob || blob.size === 0) return file
    const name = (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file) } catch { /* cai para <img> (ex.: HEIC no Safari) */ }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('decode'))
      img.src = url
    })
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
}
