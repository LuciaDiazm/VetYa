import { Ban, Check, ChevronDown, MessageCircle, StickyNote, Stethoscope, Undo2, UserX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiPatch } from '../lib/api'
import { horaDe } from '../lib/fechas'
import { enlaceWhatsapp, useSitio } from '../lib/sitio'
import { mensajeConfirmacion, ORIGENES } from '../lib/turnos'
import type { EstadoTurno, Turno } from '../types'

interface Props {
  turno: Turno
  alCambiar: (t: Turno) => void
  // Ya pasó la hora y sigue sin marcar: se avisa "Pasó la hora".
  paso?: boolean
}

// Un turno como renglón de tabla (pantalla Hoy): hora, mascota y a qué viene, quién la trae, estado
// y las acciones. Las dos más usadas van a la vista; las demás, en el menú "Más".
export function FilaTurno({ turno, alCambiar, paso }: Props) {
  const { datos } = useSitio()
  const [cambiando, setCambiando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { cliente } = turno.mascota
  const Origen = ORIGENES[turno.origen]
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

  const mensajeDueno = `Hola ${cliente.nombre}, te escribimos de ${nombreClinica} por el turno de ${turno.mascota.nombre}.`
  const avisoAusente = `Hola ${cliente.nombre}, hoy te esperábamos con ${turno.mascota.nombre} a las ${horaDe(turno.fechaHoraInicio)} en ${nombreClinica}. ¿Querés que te demos otro turno?`

  return (
    <li className={`fila-turno fila-${turno.estado}`} aria-busy={cambiando || undefined}>
      <div className="fila-hora">
        <strong>{horaDe(turno.fechaHoraInicio)}</strong>
        <span>a {horaDe(turno.fechaHoraFin)}</span>
      </div>

      <div className="fila-mascota">
        <Link to={`/panel/mascotas/${turno.mascota.id}`}>{turno.mascota.nombre}</Link>
        <span>{turno.servicio.nombre}</span>
        {turno.observaciones && (
          <span className="fila-nota">
            <StickyNote size={15} aria-hidden="true" /> “{turno.observaciones}”
          </span>
        )}
      </div>

      <div className="fila-dueno">
        <a
          href={enlaceWhatsapp(cliente.telefono, mensajeDueno)}
          target="_blank"
          rel="noreferrer"
          className="fila-whatsapp"
          aria-label={`Escribirle por WhatsApp a ${cliente.nombre} ${cliente.apellido}`}
          title="Escribirle por WhatsApp"
        >
          <MessageCircle size={20} aria-hidden="true" />
        </a>
        <span>
          {cliente.nombre} {cliente.apellido}
          <span className="fila-origen">
            <Origen.icono size={15} aria-hidden="true" /> {Origen.texto}
          </span>
        </span>
      </div>

      <div className="fila-estado">
        {turno.estado === 'ATENDIDO' ? (
          <span className="fila-estado-atendido">
            <Check size={18} aria-hidden="true" /> Atendido
          </span>
        ) : turno.estado === 'AUSENTE' ? (
          <span className="fila-estado-ausente">
            <UserX size={18} aria-hidden="true" /> No vino
          </span>
        ) : turno.estado === 'CANCELADO' ? (
          <span className="fila-estado-cancelado">
            <Ban size={18} aria-hidden="true" /> Cancelado
          </span>
        ) : (
          <>
            <strong>{turno.estado === 'PENDIENTE' ? 'Sin confirmar' : 'Confirmado'}</strong>
            {paso && <span className="fila-paso">Pasó la hora</span>}
          </>
        )}
      </div>

      <div className="fila-acciones">
        {turno.estado === 'PENDIENTE' && (
          <>
            <a
              href={enlaceWhatsapp(cliente.telefono, mensajeConfirmacion(turno, nombreClinica))}
              target="_blank"
              rel="noreferrer"
              className="boton-fila boton-fila-whatsapp"
              onClick={() => cambiar('CONFIRMADO')}
            >
              <MessageCircle size={18} aria-hidden="true" /> Confirmar
            </a>
            <MenuMas
              opciones={[
                { texto: 'Ya le confirmé por teléfono', alElegir: () => cambiar('CONFIRMADO') },
                { texto: 'Cancelar turno', peligro: true, alElegir: () => cambiar('CANCELADO') },
              ]}
              deshabilitado={cambiando}
            />
          </>
        )}

        {turno.estado === 'CONFIRMADO' && (
          <>
            <Link to={rutaConsulta} className="boton-fila">
              <Stethoscope size={18} aria-hidden="true" /> Atender
            </Link>
            <button type="button" className="boton-fila" disabled={cambiando} onClick={() => cambiar('AUSENTE')}>
              <UserX size={18} aria-hidden="true" /> No vino
            </button>
            <MenuMas
              opciones={[
                { texto: 'Atendido sin consulta', alElegir: () => cambiar('ATENDIDO') },
                { texto: 'Cancelar turno', peligro: true, alElegir: () => cambiar('CANCELADO') },
              ]}
              deshabilitado={cambiando}
            />
          </>
        )}

        {turno.estado === 'ATENDIDO' &&
          (turno.consulta ? (
            <Link to={`/panel/mascotas/${turno.mascota.id}`} className="boton-fila">
              Ver historia clínica
            </Link>
          ) : (
            <>
              <Link to={rutaConsulta} className="boton-fila">
                Cargar consulta
              </Link>
              <MenuMas opciones={[{ texto: 'Deshacer', alElegir: () => cambiar('CONFIRMADO') }]} deshabilitado={cambiando} />
            </>
          ))}

        {turno.estado === 'AUSENTE' && (
          <>
            <a href={enlaceWhatsapp(cliente.telefono, avisoAusente)} target="_blank" rel="noreferrer" className="boton-fila">
              <MessageCircle size={18} aria-hidden="true" /> Ofrecer otro turno
            </a>
            <MenuMas opciones={[{ texto: 'Deshacer', alElegir: () => cambiar('CONFIRMADO') }]} deshabilitado={cambiando} />
          </>
        )}

        {turno.estado === 'CANCELADO' && (
          <button type="button" className="boton-fila" disabled={cambiando} onClick={() => cambiar('CONFIRMADO')}>
            <Undo2 size={18} aria-hidden="true" /> Deshacer
          </button>
        )}
      </div>

      {error && (
        <p className="mensaje-error fila-error" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

// Menú "Más ▾" con las acciones menos usadas. Se cierra al elegir, al tocar afuera o con Escape.
function MenuMas({
  opciones,
  deshabilitado,
}: {
  opciones: { texto: string; peligro?: boolean; alElegir: () => void }[]
  deshabilitado?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const alTocar = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('pointerdown', alTocar)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('pointerdown', alTocar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  return (
    <div className="menu-mas" ref={caja}>
      <button
        type="button"
        className="boton-fila"
        aria-haspopup="menu"
        aria-expanded={abierto}
        disabled={deshabilitado}
        onClick={() => setAbierto((a) => !a)}
      >
        Más <ChevronDown size={18} aria-hidden="true" />
      </button>
      {abierto && (
        <ul className="menu-mas-lista" role="menu">
          {opciones.map((o) => (
            <li key={o.texto} role="none">
              <button
                type="button"
                role="menuitem"
                className={o.peligro ? 'menu-mas-peligro' : undefined}
                onClick={() => {
                  setAbierto(false)
                  o.alElegir()
                }}
              >
                {o.texto}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
