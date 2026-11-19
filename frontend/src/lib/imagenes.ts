// Antes de subir una foto se achica en el mismo navegador: una foto del celular pesa 4 a 8 MB y
// así queda en unos 300 KB, sube rápido y no llena la base. Los PDF se mandan como están.

export const TAMANIO_MAXIMO = 8 * 1024 * 1024
const LADO_MAXIMO = 1600

export function esImagen(archivo: File) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)
}

export async function prepararArchivo(archivo: File): Promise<File> {
  if (!esImagen(archivo)) return archivo
  try {
    const imagen = await createImageBitmap(archivo)
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height))
    // Si ya es chica y liviana, no se toca.
    if (escala === 1 && archivo.size < 600 * 1024) {
      imagen.close()
      return archivo
    }
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(imagen.width * escala)
    lienzo.height = Math.round(imagen.height * escala)
    lienzo.getContext('2d')?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
    imagen.close()
    const blob = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, 'image/jpeg', 0.85))
    if (!blob) return archivo
    const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], nombre, { type: 'image/jpeg' })
  } catch {
    // Si el navegador no la puede leer, se manda la original y el servidor decide.
    return archivo
  }
}

// "2,4 MB" / "350 KB"
export function pesoArchivo(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
