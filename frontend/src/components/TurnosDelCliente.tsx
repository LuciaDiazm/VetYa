import { Ban, CalendarCheck, CalendarX, CircleCheck, Pencil, UserX } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiPatch } from '../lib/api'
import { fechaCortaDe } from '../lib/fechas'
import type { ClienteDetalle } from '../types'

interface Props {
  cliente: ClienteDetalle
  alCambiar: (cambios: Partial<Pick<ClienteDetalle, 'suspendidoHasta' | 'suspensionMotivo' | 'maxTurnosOnline'>>) => void
}

// En la ficha del cliente: cómo viene con los turnos y, si tiene cuenta web, la suspensión para sacar turnos online.
export function TurnosDelCliente({ cliente, alCambiar }: Props) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { atendidos, ausentes, canceladosPorElDueno } = cliente.resumenTurnos
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'ADMIN'
  const [editandoLimite, setEditandoLimite] = useState(false)
  const [limite, setLimite] = useState('')
  const limiteActual = cliente.maxTurnosOnline ?? cliente.maxTurnosOnlineClinica
  const textoLimite = (n: number) => (n === 0 ? 'sin límite' : n === 1 ? '1 turno' : `${n} turnos`)

  async function guardarLimite(e: FormEvent | null, valor: number | null) {
    e?.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      alCambiar(await apiPatch(`/clientes/${cliente.id}/limite-turnos`, { maxTurnosOnline: valor }))
      setEditandoLimite(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar. Probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

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

      {cliente.usuario && (
        <div className="limite-cliente">
          {editandoLimite ? (
            <form className="limite-formulario" onSubmit={(e) => guardarLimite(e, Number(limite))}>
              <label className="campo campo-corto">
                Turnos por la web que puede tener a la vez
                <input type="number" min={0} max={30} value={limite} onChange={(e) => setLimite(e.target.value)} required />
                <span className="ayuda">Con 0 no tiene límite. El de la clínica es {textoLimite(cliente.maxTurnosOnlineClinica)}.</span>
              </label>
              <div className="formulario-botones">
                <button type="submit" className="boton" disabled={guardando}>
                  Guardar
                </button>
                {cliente.maxTurnosOnline !== null && (
                  <button type="button" className="boton boton-contorno" disabled={guardando} onClick={() => guardarLimite(null, null)}>
                    Usar el de la clínica
                  </button>
                )}
                <button type="button" className="boton-texto" onClick={() => setEditandoLimite(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="ayuda">
                Turnos por la web a la vez: <strong>{textoLimite(limiteActual)}</strong>
                {cliente.maxTurnosOnline === null ? ' (el de la clínica)' : ' (especial para este cliente)'}
              </p>
              {esAdmin && (
                <button
                  type="button"
                  className="boton-texto"
                  onClick={() => {
                    setLimite(String(limiteActual))
                    setEditandoLimite(true)
                  }}
                >
                  <Pencil size={18} aria-hidden="true" /> Cambiar
                </button>
              )}
            </>
          )}
        </div>
      )}

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
            {esAdmin && (
              <button type="button" className="boton boton-contorno" disabled={guardando} onClick={() => cambiar('levantar')}>
                Levantar suspensión
              </button>
            )}
          </div>
        ) : (
          <div className="suspension-cliente">
            <p className="ayuda">Puede sacar turnos por la web.</p>
            {esAdmin && (
              <button type="button" className="boton-texto texto-peligro" disabled={guardando} onClick={() => cambiar('suspender')}>
                <Ban size={18} aria-hidden="true" /> Suspender turnos web
              </button>
            )}
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
