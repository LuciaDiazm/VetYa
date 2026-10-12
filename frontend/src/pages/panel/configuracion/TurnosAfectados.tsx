import { MessageCircle } from 'lucide-react'
import { diaDe, diaLargo, horaDe } from '../../../lib/fechas'
import { enlaceWhatsapp } from '../../../lib/sitio'
import type { TurnoAfectado } from '../../../types'

// Turnos ya dados a los que hay que avisarles por un cambio (no se cancelan solos:
// la clínica decide si los atiende igual o los pasa a otro día).
export function TurnosAfectados({ turnos, motivo }: { turnos: TurnoAfectado[]; motivo: string }) {
  if (turnos.length === 0) return null
  return (
    <div className="turnos-afectados" role="alert">
      <p>
        <strong>
          {turnos.length === 1 ? 'Hay 1 turno ya dado' : `Hay ${turnos.length} turnos ya dados`} {motivo}.
        </strong>{' '}
        No se cancelan solos: avisales y pasalos a otro día desde la agenda.
      </p>
      <ul>
        {turnos.map((t) => {
          const dia = diaLargo(diaDe(t.fechaHoraInicio))
          const hora = horaDe(t.fechaHoraInicio)
          const c = t.mascota.cliente
          return (
            <li key={t.id}>
              <span>
                <strong>
                  {dia}, {hora}
                </strong>{' '}
                · {t.mascota.nombre} de {c.nombre} {c.apellido} ({t.servicio.nombre})
              </span>
              <a
                className="boton boton-whatsapp"
                target="_blank"
                rel="noreferrer"
                href={enlaceWhatsapp(
                  c.telefono,
                  `Hola ${c.nombre}, te escribimos por el turno de ${t.mascota.nombre} del ${dia} a las ${hora}: ese día no vamos a poder atender. ¿Te parece si lo pasamos a otro día?`,
                )}
              >
                <MessageCircle size={18} aria-hidden="true" /> Avisar
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
