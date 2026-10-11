import { Globe, MessageCircle, Phone, Store } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiPatch } from '../lib/api'
import { horaDe } from '../lib/fechas'
import { enlaceWhatsapp, useSitio } from '../lib/sitio'
import { ESTADOS_TURNO, mensajeConfirmacion } from '../lib/turnos'
import type { EstadoTurno, Turno } from '../types'

const ORIGENES = {
  ONLINE: { texto: 'Pedido online', icono: Globe },
  TELEFONO: { texto: 'Por teléfono', icono: Phone },
  MOSTRADOR: { texto: 'En el mostrador', icono: Store },
}

// Tarjeta de un turno con sus acciones. La usan la agenda y la pantalla "Hoy".
export function TarjetaTurno({ turno, alCambiar }: { turno: Turno; alCambiar: (t: Turno) => void }) {
  const { datos } = useSitio()
  const [cambiando, setCambiando] = useState(false)
  const Origen = ORIGENES[turno.origen]
  const { cliente } = turno.mascota

  async function cambiar(estado: EstadoTurno) {
    if (estado === 'CANCELADO' && !window.confirm(`¿Cancelar el turno de ${turno.mascota.nombre}?`)) return
    setCambiando(true)
    try {
      alCambiar(await apiPatch<Turno>(`/turnos/${turno.id}/estado`, { estado }))
    } finally {
      setCambiando(false)
    }
  }

  const terminado = turno.estado === 'ATENDIDO' || turno.estado === 'AUSENTE' || turno.estado === 'CANCELADO'

  return (
    <li className={`turno turno-${turno.estado}`}>
      <div className="turno-hora">
        <strong>{horaDe(turno.fechaHoraInicio)}</strong>
        <span>a {horaDe(turno.fechaHoraFin)}</span>
      </div>

      <div className="turno-cuerpo">
        <p className="turno-titulo">
          <Link to={`/panel/mascotas/${turno.mascota.id}`}>{turno.mascota.nombre}</Link>
          <span className="turno-servicio">{turno.servicio.nombre}</span>
        </p>
        <p className="turno-dueno">
          {cliente.nombre} {cliente.apellido}
        </p>
        {turno.observaciones && <p className="turno-observaciones">“{turno.observaciones}”</p>}
        <p className="turno-meta">
          <span className={`estado-turno estado-${turno.estado}`}>{ESTADOS_TURNO[turno.estado]}</span>
          <span className="turno-origen">
            <Origen.icono size={16} aria-hidden="true" /> {Origen.texto}
          </span>
        </p>

        {!terminado && (
          <div className="turno-acciones">
            {turno.estado === 'PENDIENTE' && (
              <a
                href={datos ? enlaceWhatsapp(cliente.telefono, mensajeConfirmacion(turno, datos.clinica.nombre)) : undefined}
                target="_blank"
                rel="noreferrer"
                className="boton boton-whatsapp"
                onClick={() => cambiar('CONFIRMADO')}
              >
                <MessageCircle size={18} aria-hidden="true" /> Confirmar por WhatsApp
              </a>
            )}
            <button type="button" className="boton" disabled={cambiando} onClick={() => cambiar('ATENDIDO')}>
              Atendido
            </button>
            <button type="button" className="boton boton-contorno" disabled={cambiando} onClick={() => cambiar('AUSENTE')}>
              No vino
            </button>
            <button type="button" className="boton-texto texto-peligro" disabled={cambiando} onClick={() => cambiar('CANCELADO')}>
              Cancelar
            </button>
          </div>
        )}
        {terminado && turno.estado !== 'CANCELADO' && (
          <button type="button" className="boton-texto enlace-chico" onClick={() => cambiar('CONFIRMADO')}>
            Deshacer
          </button>
        )}
      </div>
    </li>
  )
}

