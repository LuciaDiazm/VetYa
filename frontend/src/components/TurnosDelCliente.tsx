import { Ban, CalendarCheck, CalendarX, CircleCheck, UserX } from 'lucide-react'
import { useState } from 'react'
import { apiPatch } from '../lib/api'
import { fechaCortaDe } from '../lib/fechas'
import type { ClienteDetalle } from '../types'

interface Props {
  cliente: ClienteDetalle
  alCambiar: (cambios: Pick<ClienteDetalle, 'suspendidoHasta' | 'suspensionMotivo'>) => void
}

// En la ficha del cliente: cómo viene con los turnos y, si tiene cuenta web, la suspensión para sacar turnos online.
export function TurnosDelCliente({ cliente, alCambiar }: Props) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { atendidos, ausentes, canceladosPorElDueno } = cliente.resumenTurnos

  async function cambiar(accion: 'suspender' | 'levantar') {
    const pregunta =
      accion === 'suspender'
        ? `¿Suspender a ${cliente.nombre}? No va a poder sacar turnos por la web por un tiempo (los puede pedir por WhatsApp).`
        : '¿Levantar la suspensión? Va a poder sacar turnos por la web otra vez.'
    if (!window.confirm(pregunta)) return
    setGuardando(true)
    setError(null)
    try {
      alCambiar(await apiPatch(`/clientes/${cliente.id}/suspension`, { accion }))
    } catch {
      setError('No se pudo guardar. Probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="tarjeta bloque-ficha">
      <div className="bloque-ficha-titulo">
        <h2>
          <CalendarCheck size={22} aria-hidden="true" /> Turnos de los últimos 6 meses
        </h2>
      </div>
      <ul className="chips chips-chicas resumen-cliente">
        <li className="chip chip-dato">
          <CircleCheck size={18} aria-hidden="true" /> Vino {atendidos} {atendidos === 1 ? 'vez' : 'veces'}
        </li>
        <li className="chip chip-dato">
          <UserX size={18} aria-hidden="true" /> Faltó {ausentes} {ausentes === 1 ? 'vez' : 'veces'}
        </li>
        <li className="chip chip-dato">
          <CalendarX size={18} aria-hidden="true" /> Canceló por la web {canceladosPorElDueno}{' '}
          {canceladosPorElDueno === 1 ? 'vez' : 'veces'}
        </li>
      </ul>

      {cliente.usuario &&
        (cliente.suspendidoHasta ? (
          <div className="suspension-cliente">
            <p className="estado-suspension">
              <Ban size={20} aria-hidden="true" />
              <span>
                <strong>No puede sacar turnos por la web hasta el {fechaCortaDe(cliente.suspendidoHasta)}.</strong>{' '}
                {cliente.suspensionMotivo}.
              </span>
            </p>
            <button type="button" className="boton boton-contorno" disabled={guardando} onClick={() => cambiar('levantar')}>
              Levantar suspensión
            </button>
          </div>
        ) : (
          <div className="suspension-cliente">
            <p className="ayuda">Puede sacar turnos por la web.</p>
            <button type="button" className="boton-texto texto-peligro" disabled={guardando} onClick={() => cambiar('suspender')}>
              <Ban size={18} aria-hidden="true" /> Suspender turnos web
            </button>
          </div>
        ))}
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
