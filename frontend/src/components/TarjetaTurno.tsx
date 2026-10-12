import {
  Ban,
  CalendarCheck,
  Check,
  Clock,
  Globe,
  MessageCircle,
  Phone,
  Stethoscope,
  Store,
  Undo2,
  UserX,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiPatch } from '../lib/api'
import { horaDe } from '../lib/fechas'
import { formatearTelefono } from '../lib/mascotas'
import { enlaceWhatsapp, useSitio } from '../lib/sitio'
import { ESTADOS_TURNO, mensajeConfirmacion } from '../lib/turnos'
import type { EstadoTurno, Turno } from '../types'

const ORIGENES = {
  ONLINE: { texto: 'Pedido online', icono: Globe },
  TELEFONO: { texto: 'Por teléfono', icono: Phone },
  MOSTRADOR: { texto: 'En el mostrador', icono: Store },
}

// El estado siempre se muestra con ícono y texto, no solo con color.
const ICONOS_ESTADO = {
  PENDIENTE: Clock,
  CONFIRMADO: CalendarCheck,
  ATENDIDO: Check,
  AUSENTE: UserX,
  CANCELADO: Ban,
}

interface Props {
  turno: Turno
  alCambiar: (t: Turno) => void
  // "Sigue": el próximo turno del día. "Pasado": ya pasó la hora y nadie lo marcó.
  marca?: 'sigue' | 'pasado'
}

// Tarjeta de un turno. Muestra una sola acción principal según el estado (lo que hay que hacer ahora)
// y las demás más chicas, para que se entienda de un vistazo. La usan la agenda y la pantalla "Hoy".
export function TarjetaTurno({ turno, alCambiar, marca }: Props) {
  const { datos } = useSitio()
  const [cambiando, setCambiando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const Origen = ORIGENES[turno.origen]
  const IconoEstado = ICONOS_ESTADO[turno.estado]
  const { cliente } = turno.mascota
  const nombreClinica = datos?.clinica.nombre ?? 'la veterinaria'
  const rutaConsulta = `/panel/mascotas/${turno.mascota.id}/consulta?turno=${turno.id}`

  async function cambiar(estado: EstadoTurno) {
    if (estado === 'CANCELADO' && !window.confirm(`¿Cancelar el turno de ${turno.mascota.nombre}?`)) return
    setCambiando(true)
    setError(null)
    try {
      alCambiar(await apiPatch<Turno>(`/turnos/${turno.id}/estado`, { estado }))
    } catch {
      setError('No se pudo guardar el cambio. Probá de nuevo.')
    } finally {
      setCambiando(false)
    }
  }

  const avisoAusente = `Hola ${cliente.nombre}, hoy te esperábamos con ${turno.mascota.nombre} a las ${horaDe(turno.fechaHoraInicio)} en ${nombreClinica}. ¿Querés que te demos otro turno?`

  return (
    <li
      className={`turno turno-${turno.estado}${marca ? ` turno-${marca}` : ''}`}
      aria-busy={cambiando || undefined}
    >
      <div className="turno-hora">
        <strong>{horaDe(turno.fechaHoraInicio)}</strong>
        <span>a {horaDe(turno.fechaHoraFin)}</span>
        {marca === 'sigue' && <span className="turno-sigue">Sigue</span>}
      </div>

      <div className="turno-cuerpo">
        <div className="turno-encabezado">
          <p className="turno-titulo">
            <Link to={`/panel/mascotas/${turno.mascota.id}`}>{turno.mascota.nombre}</Link>
            <span className="turno-servicio">{turno.servicio.nombre}</span>
          </p>
          <span className={`estado-turno estado-${turno.estado}`}>
            <IconoEstado size={16} aria-hidden="true" /> {ESTADOS_TURNO[turno.estado]}
          </span>
        </div>
        <p className="turno-dueno">
          {cliente.nombre} {cliente.apellido} ·{' '}
          <a href={`tel:+${cliente.telefono}`} className="turno-telefono">
            {formatearTelefono(cliente.telefono)}
          </a>
        </p>
        {turno.observaciones && <p className="turno-observaciones">“{turno.observaciones}”</p>}
        <p className="turno-origen">
          <Origen.icono size={16} aria-hidden="true" /> {Origen.texto}
        </p>

        {marca === 'pasado' && <p className="turno-pregunta">Ya pasó la hora: ¿vino?</p>}

        {/* ---------- Acciones según el estado ---------- */}
        {turno.estado === 'PENDIENTE' && (
          <div className="turno-acciones">
            <a
              href={enlaceWhatsapp(cliente.telefono, mensajeConfirmacion(turno, nombreClinica))}
              target="_blank"
              rel="noreferrer"
              className="boton boton-whatsapp"
              onClick={() => cambiar('CONFIRMADO')}
            >
              <MessageCircle size={18} aria-hidden="true" /> Confirmar por WhatsApp
            </a>
            <button type="button" className="boton-texto" disabled={cambiando} onClick={() => cambiar('CONFIRMADO')}>
              Ya le confirmé por teléfono
            </button>
            <button
              type="button"
              className="boton-texto texto-peligro turno-cancelar"
              disabled={cambiando}
              onClick={() => cambiar('CANCELADO')}
            >
              Cancelar turno
            </button>
          </div>
        )}

        {turno.estado === 'CONFIRMADO' && (
          <div className="turno-acciones">
            <Link to={rutaConsulta} className="boton">
              <Stethoscope size={18} aria-hidden="true" /> Atender
            </Link>
            <button type="button" className="boton boton-contorno" disabled={cambiando} onClick={() => cambiar('AUSENTE')}>
              <UserX size={18} aria-hidden="true" /> No vino
            </button>
            <button type="button" className="boton-texto" disabled={cambiando} onClick={() => cambiar('ATENDIDO')}>
              Atendido sin consulta
            </button>
            <button
              type="button"
              className="boton-texto texto-peligro turno-cancelar"
              disabled={cambiando}
              onClick={() => cambiar('CANCELADO')}
            >
              Cancelar turno
            </button>
          </div>
        )}

        {turno.estado === 'ATENDIDO' && (
          <div className="turno-acciones">
            {turno.consulta ? (
              <Link to={`/panel/mascotas/${turno.mascota.id}`} className="boton boton-contorno">
                Ver historia clínica
              </Link>
            ) : (
              <Link to={rutaConsulta} className="boton">
                Cargar consulta
              </Link>
            )}
            {!turno.consulta && (
              <button type="button" className="boton-texto" disabled={cambiando} onClick={() => cambiar('CONFIRMADO')}>
                <Undo2 size={16} aria-hidden="true" /> Deshacer
              </button>
            )}
          </div>
        )}

        {turno.estado === 'AUSENTE' && (
          <div className="turno-acciones">
            <a
              href={enlaceWhatsapp(cliente.telefono, avisoAusente)}
              target="_blank"
              rel="noreferrer"
              className="boton boton-contorno"
            >
              <MessageCircle size={18} aria-hidden="true" /> Ofrecerle otro turno
            </a>
            <button type="button" className="boton-texto" disabled={cambiando} onClick={() => cambiar('CONFIRMADO')}>
              <Undo2 size={16} aria-hidden="true" /> Deshacer
            </button>
          </div>
        )}

        {error && (
          <p className="mensaje-error turno-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </li>
  )
}
