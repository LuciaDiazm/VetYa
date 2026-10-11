import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TarjetaTurno } from '../../components/TarjetaTurno'
import { apiGet } from '../../lib/api'
import { diaAmigable, diaCorto, diaDe, diaLargo, hoyArgentina, lunesDe, sumarDias } from '../../lib/fechas'
import type { Turno } from '../../types'

export function Agenda() {
  const [parametros, setParametros] = useSearchParams()
  const dia = parametros.get('dia') ?? hoyArgentina()
  const lunes = lunesDe(dia)
  const [turnosSemana, setTurnosSemana] = useState<Turno[] | null>(null)
  const [verCancelados, setVerCancelados] = useState(false)

  const cargar = useCallback(() => {
    apiGet<Turno[]>(`/turnos?desde=${lunes}&hasta=${sumarDias(lunes, 6)}`)
      .then(setTurnosSemana)
      .catch(() => setTurnosSemana([]))
  }, [lunes])
  useEffect(cargar, [cargar])

  const irA = (d: string) => setParametros(d === hoyArgentina() ? {} : { dia: d })

  const delDia = useMemo(() => (turnosSemana ?? []).filter((t) => diaDe(t.fechaHoraInicio) === dia), [turnosSemana, dia])
  const activos = delDia.filter((t) => t.estado !== 'CANCELADO')
  const cancelados = delDia.filter((t) => t.estado === 'CANCELADO')
  const pendientes = activos.filter((t) => t.estado === 'PENDIENTE').length

  function reemplazar(t: Turno) {
    setTurnosSemana((lista) => lista?.map((x) => (x.id === t.id ? t : x)) ?? null)
  }

  return (
    <>
      <div className="panel-encabezado panel-encabezado-acciones">
        <div>
          <h1>Agenda</h1>
          <p>
            {diaAmigable(dia) === diaLargo(dia) ? '' : `${diaAmigable(dia)}, `}
            {diaLargo(dia)}
          </p>
        </div>
        <Link to={`/panel/agenda/nuevo?fecha=${dia}`} className="boton boton-grande boton-secundario">
          <CalendarPlus size={22} aria-hidden="true" /> Dar turno
        </Link>
      </div>

      {/* ---------- Semana ---------- */}
      <div className="semana">
        <button type="button" className="boton-flecha" onClick={() => irA(sumarDias(dia, -7))} aria-label="Semana anterior">
          <ChevronLeft size={24} />
        </button>
        <div className="semana-dias">
          {Array.from({ length: 6 }, (_, i) => sumarDias(lunes, i)).map((d) => {
            const cantidad = (turnosSemana ?? []).filter((t) => diaDe(t.fechaHoraInicio) === d && t.estado !== 'CANCELADO').length
            return (
              <button
                key={d}
                type="button"
                className={`semana-dia${d === dia ? ' activo' : ''}${d === hoyArgentina() ? ' es-hoy' : ''}`}
                aria-pressed={d === dia}
                onClick={() => irA(d)}
              >
                <span>{diaCorto(d)}</span>
                <strong>{cantidad === 0 ? '—' : cantidad === 1 ? '1 turno' : `${cantidad} turnos`}</strong>
              </button>
            )
          })}
        </div>
        <button type="button" className="boton-flecha" onClick={() => irA(sumarDias(dia, 7))} aria-label="Semana siguiente">
          <ChevronRight size={24} />
        </button>
      </div>
      {dia !== hoyArgentina() && (
        <button type="button" className="boton-texto enlace-chico volver-hoy" onClick={() => irA(hoyArgentina())}>
          Volver a hoy
        </button>
      )}

      {pendientes > 0 && (
        <p className="aviso-pendientes">
          {pendientes === 1 ? 'Hay 1 turno pedido online' : `Hay ${pendientes} turnos pedidos online`} esperando tu
          confirmación.
        </p>
      )}

      {/* ---------- Turnos del día ---------- */}
      {turnosSemana === null ? (
        <p className="cargando">Cargando…</p>
      ) : activos.length === 0 ? (
        <div className="tarjeta vacio-con-accion">
          <p className="vacio">No hay turnos para este día.</p>
          <Link to={`/panel/agenda/nuevo?fecha=${dia}`} className="boton">
            <CalendarPlus size={20} aria-hidden="true" /> Dar un turno
          </Link>
        </div>
      ) : (
        <ul className="lista-turnos">
          {activos.map((t) => (
            <TarjetaTurno key={t.id} turno={t} alCambiar={reemplazar} />
          ))}
        </ul>
      )}

      {cancelados.length > 0 && (
        <div className="cancelados">
          <button type="button" className="boton-texto enlace-chico" onClick={() => setVerCancelados((v) => !v)}>
            {verCancelados ? 'Ocultar' : 'Ver'} cancelados ({cancelados.length})
          </button>
          {verCancelados && (
            <ul className="lista-turnos">
              {cancelados.map((t) => (
                <TarjetaTurno key={t.id} turno={t} alCambiar={reemplazar} />
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}
