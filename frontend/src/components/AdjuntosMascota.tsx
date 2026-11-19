import { FileText, Image, Paperclip, X } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { apiPatch, apiSubir } from '../lib/api'
import { fechaCortaDe } from '../lib/fechas'
import { esImagen, pesoArchivo, prepararArchivo, TAMANIO_MAXIMO } from '../lib/imagenes'
import { esDeHoy } from '../lib/permisos'
import type { Adjunto, ConsultaResumen, Usuario } from '../types'

interface Props {
  mascotaId: number
  adjuntos: Adjunto[]
  consultas: ConsultaResumen[]
  usuario: Usuario | null
  puedeSubir: boolean
  alCambiar: () => void
}

// Análisis, ecografías, radiografías o fotos de la historia clínica (fotos o PDF de hasta 8 MB).
// Se guardan en la base, así no se pierden. Quitar uno lo saca de la ficha pero queda anotado.
export function AdjuntosMascota({ mascotaId, adjuntos, consultas, usuario, puedeSubir, alCambiar }: Props) {
  const entrada = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [descripcion, setDescripcion] = useState('')
  const [consultaId, setConsultaId] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function elegir(f: File | undefined) {
    setError(null)
    if (!f) return
    if (!esImagen(f) && f.type !== 'application/pdf') {
      setError('Solo se pueden adjuntar fotos (JPG, PNG, WEBP) o PDF')
      return
    }
    setArchivo(f)
  }

  async function subir(e: FormEvent) {
    e.preventDefault()
    if (!archivo) return
    setSubiendo(true)
    setError(null)
    try {
      const listo = await prepararArchivo(archivo)
      if (listo.size > TAMANIO_MAXIMO) throw new Error('El archivo puede pesar hasta 8 MB')
      const formulario = new FormData()
      formulario.append('mascotaId', String(mascotaId))
      if (consultaId) formulario.append('consultaId', consultaId)
      if (descripcion.trim()) formulario.append('descripcion', descripcion.trim())
      formulario.append('archivo', listo)
      await apiSubir('/consultas/adjuntos', formulario)
      setArchivo(null)
      setDescripcion('')
      setConsultaId('')
      if (entrada.current) entrada.current.value = ''
      alCambiar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el archivo')
    } finally {
      setSubiendo(false)
    }
  }

  async function quitar(a: Adjunto) {
    if (!window.confirm(`¿Quitar “${a.descripcion ?? a.archivo.nombre}” de la ficha? Queda anotado en el registro de cambios.`)) return
    try {
      await apiPatch(`/consultas/adjuntos/${a.id}/quitar`, {})
      alCambiar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar el archivo')
    }
  }

  const motivoDe = (id: number | null) => consultas.find((c) => c.id === id)

  return (
    <div className="adjuntos">
      {adjuntos.length === 0 ? (
        <p className="vacio">Todavía no tiene análisis ni estudios adjuntos.</p>
      ) : (
        <ul className="adjuntos-lista">
          {adjuntos.map((a) => {
            const Icono = a.archivo.tipo === 'application/pdf' ? FileText : Image
            const consulta = motivoDe(a.consultaId)
            const quita = puedeSubir && (usuario?.rol === 'ADMIN' || (a.subidoPor.id === usuario?.id && esDeHoy(a.creadoEn)))
            return (
              <li key={a.id}>
                <Icono size={22} aria-hidden="true" className="adjunto-icono" />
                <span className="adjunto-texto">
                  <a href={`/api/archivos/${a.archivoId}`} target="_blank" rel="noreferrer">
                    {a.descripcion ?? a.archivo.nombre}
                  </a>
                  <span className="ayuda">
                    {fechaCortaDe(a.creadoEn)} · {pesoArchivo(a.archivo.tamanio)}
                    {consulta && ` · consulta: ${consulta.motivo}`} · subió {a.subidoPor.nombre}
                  </span>
                </span>
                {quita && (
                  <button
                    type="button"
                    className="boton-icono"
                    onClick={() => quitar(a)}
                    aria-label={`Quitar ${a.descripcion ?? a.archivo.nombre}`}
                    title="Quitar de la ficha"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {puedeSubir && (
        <form className="adjuntos-subir" onSubmit={subir}>
          <input
            ref={entrada}
            id={`adjunto-${mascotaId}`}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="solo-lectores"
            onChange={(e) => elegir(e.target.files?.[0])}
          />
          {!archivo ? (
            <label htmlFor={`adjunto-${mascotaId}`} className="boton boton-contorno">
              <Paperclip size={18} aria-hidden="true" /> Adjuntar análisis o estudio
            </label>
          ) : (
            <>
              <p className="adjunto-elegido">
                <Paperclip size={16} aria-hidden="true" /> {archivo.name} <span className="ayuda">({pesoArchivo(archivo.size)})</span>
              </p>
              <label className="campo">
                Qué es (opcional)
                <input
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  maxLength={200}
                  placeholder="Ej.: Análisis de sangre, Ecografía abdominal"
                />
              </label>
              {consultas.length > 0 && (
                <label className="campo">
                  De qué consulta (opcional)
                  <select value={consultaId} onChange={(e) => setConsultaId(e.target.value)}>
                    <option value="">De ninguna en especial</option>
                    {consultas.slice(0, 10).map((c) => (
                      <option key={c.id} value={c.id}>
                        {fechaCortaDe(c.fecha)}: {c.motivo}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="formulario-botones">
                <button type="submit" className="boton" disabled={subiendo}>
                  {subiendo ? 'Subiendo…' : 'Guardar archivo'}
                </button>
                <button
                  type="button"
                  className="boton-texto"
                  onClick={() => {
                    setArchivo(null)
                    if (entrada.current) entrada.current.value = ''
                  }}
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </form>
      )}
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
