import { CalendarClock, MessageCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { apiGet, apiPatch } from '../lib/api'
import { diaDe, diaLargo, horaDe, hoyArgentina } from '../lib/fechas'
import { enlaceWhatsapp } from '../lib/sitio'
import type { Turno } from '../types'

interface Props {
  turno: Turno
  clinica: string
  alTerminar: (movido: Turno | null) => void
}

// Cambiar el día o la hora de un turno sin cancelarlo: se elige el día, aparecen los horarios libres
// y, al guardar, queda listo el mensaje de WhatsApp para avisarle al dueño.
export function MoverTurno({ turno, clinica, alTerminar }: Props) {
  const [fecha, setFecha] = useState('')
  const [horas, setHoras] = useState<string[] | null>(null)
  const [hora, setHora] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [movido, setMovido] = useState<Turno | null>(null)
  const hoy = hoyArgentina()

  async function elegirDia(nueva: string) {
    setFecha(nueva)
    setHora('')
    setHoras(null)
    setError(null)
    if (!nueva) return
    try {
      setHoras(
        await apiGet<string[]>(`/turnos/disponibilidad?servicioId=${turno.servicio.id}&fecha=${nueva}&ignorar=${turno.id}`),
      )
    } catch {
      setError('No se pudieron traer los horarios. Probá de nuevo.')
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!fecha || !hora) return
    setGuardando(true)
    setError(null)
    try {
      setMovido(await apiPatch<Turno>(`/turnos/${turno.id}/mover`, { fecha, hora }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mover el turno')
    } finally {
      setGuardando(false)
    }
  }

  if (movido) {
    const cuando = `${diaLargo(diaDe(movido.fechaHoraInicio))} a las ${horaDe(movido.fechaHoraInicio)}`
    const mensaje =
      `Hola ${turno.mascota.cliente.nombre}, te escribimos de ${clinica}: el turno de ${turno.mascota.nombre} ` +
      `(${turno.servicio.nombre}) pasó al ${cuando}. Si no te queda bien, avisanos.`
    return (
      <div className="mover-turno" role="status">
        <p className="mover-listo">
          <CalendarClock size={18} aria-hidden="true" /> Turno movido al <strong>{cuando}</strong>
        </p>
        <div className="mover-botones">
          <a
            href={enlaceWhatsapp(turno.mascota.cliente.telefono, mensaje)}
            target="_blank"
            rel="noreferrer"
            className="boton-fila boton-fila-whatsapp"
            onClick={() => alTerminar(movido)}
          >
            <MessageCircle size={18} aria-hidden="true" /> Avisarle por WhatsApp
          </a>
          <button type="button" className="boton-fila" onClick={() => alTerminar(movido)}>
            Listo
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="mover-turno" onSubmit={guardar} aria-label={`Cambiar día u hora del turno de ${turno.mascota.nombre}`}>
      <label className="mover-campo">
        Día
        <input type="date" min={hoy} value={fecha} onChange={(e) => elegirDia(e.target.value)} required autoFocus />
      </label>
      <label className="mover-campo">
        Hora
        <select value={hora} onChange={(e) => setHora(e.target.value)} required disabled={!horas || horas.length === 0}>
          <option value="">{!fecha ? 'Elegí el día' : !horas ? 'Buscando…' : horas.length === 0 ? 'Sin lugar ese día' : 'Elegí'}</option>
          {horas?.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>
      <div className="mover-botones">
        <button type="submit" className="boton-fila boton-fila-principal" disabled={!hora || guardando}>
          {guardando ? 'Guardando…' : 'Mover turno'}
        </button>
        <button type="button" className="boton-fila" onClick={() => alTerminar(null)}>
          Cancelar
        </button>
      </div>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
