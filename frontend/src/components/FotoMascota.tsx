import { Camera } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { apiDelete, apiSubir } from '../lib/api'
import { prepararArchivo, TAMANIO_MAXIMO } from '../lib/imagenes'

interface Props {
  mascotaId: number
  nombre: string
  fotoUrl: string | null | undefined
  sinFoto: ReactNode // lo que se ve si no tiene foto (el ícono del animal)
  editable: boolean
  alCambiar: (fotoUrl: string | null) => void
}

// Foto de la mascota en su ficha. Desde el celular abre la cámara; se achica antes de subirla.
export function FotoMascota({ mascotaId, nombre, fotoUrl, sinFoto, editable, alCambiar }: Props) {
  const entrada = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function elegir(archivo: File | undefined) {
    if (!archivo) return
    setError(null)
    setSubiendo(true)
    try {
      const listo = await prepararArchivo(archivo)
      if (listo.size > TAMANIO_MAXIMO) throw new Error('La foto puede pesar hasta 8 MB')
      const formulario = new FormData()
      formulario.append('foto', listo)
      const { fotoUrl: nueva } = await apiSubir<{ fotoUrl: string }>(`/mascotas/${mascotaId}/foto`, formulario)
      alCambiar(nueva)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la foto')
    } finally {
      setSubiendo(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  async function quitar() {
    if (!window.confirm(`¿Quitar la foto de ${nombre}?`)) return
    try {
      await apiDelete(`/mascotas/${mascotaId}/foto`)
      alCambiar(null)
    } catch {
      setError('No se pudo quitar la foto')
    }
  }

  return (
    <div className="foto-mascota">
      {fotoUrl ? (
        <img src={fotoUrl} alt={`Foto de ${nombre}`} className="foto-mascota-imagen" width={112} height={112} />
      ) : (
        sinFoto
      )}
      {editable && (
        <>
          <input
            ref={entrada}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="solo-lectores"
            tabIndex={-1}
            onChange={(e) => elegir(e.target.files?.[0])}
          />
          <span className="foto-mascota-botones">
            <button type="button" className="boton-texto enlace-chico" disabled={subiendo} onClick={() => entrada.current?.click()}>
              <Camera size={16} aria-hidden="true" /> {subiendo ? 'Subiendo…' : fotoUrl ? 'Cambiar foto' : 'Poner foto'}
            </button>
            {fotoUrl && !subiendo && (
              <button type="button" className="boton-texto enlace-chico texto-peligro" onClick={quitar}>
                Quitar
              </button>
            )}
          </span>
        </>
      )}
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
