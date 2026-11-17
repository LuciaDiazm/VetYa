import { CalendarPlus, ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TarjetaTurno } from '../../components/TarjetaTurno'
import { apiGet } from '../../lib/api'
import { diaAmigable, diaDe, diaLargo, horaDe, hoyArgentina, lunesDe, sumarDias } from '../../lib/fechas'
import { useHoraActual } from '../../lib/horaActual'
import { useSitio } from '../../lib/sitio'
import { ESTADOS_TURNO, huecosLibres, type Hueco } from '../../lib/turnos'
import type { Turno } from '../../types'

const DIA_SEMANA = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' })
const NUMERO_DIA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', timeZone: 'UTC' })

interface DiaCerrado {
  fecha: string
  motivo: string | null
}

// Lo que se muestra en la línea del día: turnos, ratos libres y la marca de "ahora", en orden de hora.
type Renglon =
  | { tipo: 'turno'; hora: string; turno: Turno }
  | { tipo: 'libre'; hora: string; hueco: Hueco }
  | { tipo: 'ahora'; hora: string }

function plural(cantidad: number, uno: string, varios: string) {
  return `${cantidad} ${cantidad === 1 ? uno : varios}`
}

export function Agenda() {
  const [parametros, setParametros] = useSearchParams()
  const hoy = hoyArgentina()
  const dia = parametros.get('dia') ?? hoy
  const esHoy = dia === hoy
  const lunes = lunesDe(dia)
  const ahora = useHoraActual()
  const { datos: sitio } = useSitio()
  const [turnosSemana, setTurnosSemana] = useState<Turno[] | null>(null)
  const [cerrados, setCerrados] = useState<DiaCerrado[]>([])
  const [verCancelados, setVerCancelados] = useState(false)
  const [anuncio, setAnuncio] = useState('')

  const cargar = useCallback(() => {
    const hasta = sumarDias(lunes, 6)
    apiGet<Turno[]>(`/turnos?desde=${lunes}&hasta=${hasta}`)
      .then(setTurnosSemana)
      .catch(() => setTurnosSemana([]))
    apiGet<DiaCerrado[]>(`/turnos/dias-cerrados?desde=${lunes}&hasta=${hasta}`)
      .then(setCerrados)
      .catch(() => setCerrados([]))
  }, [lunes])
  useEffect(cargar, [cargar])

  const irA = (d: string) => setParametros(d === hoyArgentina() ? {} : { dia: d })

  const delDia = useMemo(() => (turnosSemana ?? []).filter((t) => diaDe(t.fechaHoraInicio) === dia), [turnosSemana, dia])
  const activos = useMemo(() => delDia.filter((t) => t.estado !== 'CANCELADO'), [delDia])
  const cancelados = delDia.filter((t) => t.estado === 'CANCELADO')
  const cerradoHoy = cerrados.find((c) => c.fecha === dia)
  const cuenta = (estado: Turno['estado']) => activos.filter((t) => t.estado === estado).length

  // Línea del día. Los ratos libres solo se muestran para hoy (desde ahora) y días futuros.
  const renglones = useMemo(() => {
    const lista: Renglon[] = activos.map((t) => ({ tipo: 'turno', hora: horaDe(t.fechaHoraInicio), turno: t }))
    if (sitio && !cerradoHoy && dia >= hoy) {
      for (const hueco of huecosLibres(sitio.clinica.horarios, activos, dia, esHoy ? ahora : undefined)) {
        lista.push({ tipo: 'libre', hora: hueco.inicio, hueco })
      }
    }
    lista.sort((a, b) => a.hora.localeCompare(b.hora) || (a.tipo === 'turno' ? -1 : 1))
    if (esHoy && lista.length > 0) {
      const posicion = lista.findIndex((r) => r.hora >= ahora)
      lista.splice(posicion === -1 ? lista.length : posicion, 0, { tipo: 'ahora', hora: ahora })
    }
    return lista
  }, [activos, sitio, cerradoHoy, dia, hoy, esHoy, ahora])

  // El próximo turno por atender de hoy, y los que ya pasaron sin que nadie los marque.
  const proximoId = esHoy
    ? activos.find((t) => (t.estado === 'CONFIRMADO' || t.estado === 'PENDIENTE') && horaDe(t.fechaHoraInicio) >= ahora)?.id
    : undefined
  const yaPaso = (t: Turno) => t.estado === 'CONFIRMADO' && (dia < hoy || (esHoy && horaDe(t.fechaHoraFin) <= ahora))

  function reemplazar(t: Turno) {
    setTurnosSemana((lista) => lista?.map((x) => (x.id === t.id ? t : x)) ?? null)
    setAnuncio(`Turno de ${t.mascota.nombre}: ${ESTADOS_TURNO[t.estado].toLowerCase()}.`)
  }

  const pendientes = cuenta('PENDIENTE')
  const atendidos = cuenta('ATENDIDO')
  const ausentes = cuenta('AUSENTE')

  return (
    <>
      <div className="panel-encabezado panel-encabezado-acciones">
        <div>
          <h1>Agenda</h1>
          <p className="agenda-fecha">
            {diaAmigable(dia) === diaLargo(dia) ? diaLargo(dia) : `${diaAmigable(dia)}, ${diaLargo(dia)}`}
          </p>
        </div>
        <Link to={`/panel/agenda/nuevo?fecha=${dia}`} className="boton boton-grande boton-secundario">
          <CalendarPlus size={22} aria-hidden="true" /> Dar turno
        </Link>
      </div>

      {/* ---------- Semana ---------- */}
      <nav className="semana" aria-label="Días de la semana">
        <button type="button" className="boton-flecha" onClick={() => irA(sumarDias(dia, -7))} aria-label="Semana anterior">
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <div className="semana-dias">
          {Array.from({ length: 6 }, (_, i) => sumarDias(lunes, i)).map((d) => {
            const cantidad = (turnosSemana ?? []).filter(
              (t) => diaDe(t.fechaHoraInicio) === d && t.estado !== 'CANCELADO',
            ).length
            const cerrado = cerrados.some((c) => c.fecha === d)
            const fecha = new Date(`${d}T12:00:00Z`)
            return (
              <button
                key={d}
                type="button"
                className={`semana-dia${d === dia ? ' activo' : ''}${d === hoy ? ' es-hoy' : ''}${cerrado ? ' cerrado' : ''}`}
                aria-current={d === dia ? 'date' : undefined}
                aria-label={`${diaLargo(d)}${d === hoy ? ' (hoy)' : ''}: ${cerrado ? 'cerrado' : plural(cantidad, 'turno', 'turnos')}`}
                onClick={() => irA(d)}
              >
                <span className="semana-dia-nombre">{d === hoy ? 'Hoy' : DIA_SEMANA.format(fecha).replace('.', '')}</span>
                <span className="semana-dia-numero">{NUMERO_DIA.format(fecha)}</span>
                <span className="semana-dia-cantidad" aria-hidden="true">
                  {cerrado ? (
                    'Cerrado'
                  ) : cantidad === 0 ? (
                    '—'
                  ) : (
                    <>
                      {cantidad}
                      <span className="semana-dia-palabra"> {cantidad === 1 ? 'turno' : 'turnos'}</span>
                    </>
                  )}
                </span>
              </button>
            )
          })}
        </div>
        <button type="button" className="boton-flecha" onClick={() => irA(sumarDias(dia, 7))} aria-label="Semana siguiente">
          <ChevronRight size={24} aria-hidden="true" />
        </button>
      </nav>
      {!esHoy && (
        <button type="button" className="boton-texto enlace-chico volver-hoy" onClick={() => irA(hoy)}>
          Volver a hoy
        </button>
      )}

      {/* ---------- Resumen del día ---------- */}
      {activos.length > 0 && (
        <ul className="resumen-dia" aria-label="Resumen del día">
          <li>
            <strong>{activos.length}</strong> {activos.length === 1 ? 'turno' : 'turnos'}
          </li>
          {pendientes > 0 && (
            <li className="resumen-pendientes">
              <strong>{pendientes}</strong> por confirmar
            </li>
          )}
          {atendidos > 0 && (
            <li>
              <strong>{atendidos}</strong> {atendidos === 1 ? 'atendido' : 'atendidos'}
            </li>
          )}
          {ausentes > 0 && (
            <li>
              <strong>{ausentes}</strong> no {ausentes === 1 ? 'vino' : 'vinieron'}
            </li>
          )}
        </ul>
      )}

      {cerradoHoy && (
        <p className="aviso-cerrado">
          La clínica no atiende este día{cerradoHoy.motivo ? ` (${cerradoHoy.motivo})` : ''}. No se ofrecen turnos en
          la web.
          {activos.length > 0 && ' Los turnos de abajo se dieron antes de cerrarlo: avisales.'}
        </p>
      )}

      {/* ---------- Línea del día ---------- */}
      {turnosSemana === null ? (
        <p className="cargando">Cargando…</p>
      ) : renglones.length === 0 ? (
        <div className="tarjeta vacio-con-accion">
          <p className="vacio">{dia < hoy ? 'Ese día no hubo turnos.' : 'No hay turnos para este día.'}</p>
          {dia >= hoy && !cerradoHoy && (
            <Link to={`/panel/agenda/nuevo?fecha=${dia}`} className="boton">
              <CalendarPlus size={20} aria-hidden="true" /> Dar un turno
            </Link>
          )}
        </div>
      ) : (
        <ul className="lista-turnos" aria-label="Turnos del día">
          {renglones.map((r) =>
            r.tipo === 'turno' ? (
              <TarjetaTurno
                key={r.turno.id}
                turno={r.turno}
                alCambiar={reemplazar}
                marca={r.turno.id === proximoId ? 'sigue' : yaPaso(r.turno) ? 'pasado' : undefined}
              />
            ) : r.tipo === 'libre' ? (
              <li key={`libre-${r.hora}`} className="hueco-libre">
                <span>
                  <Clock size={18} aria-hidden="true" /> Libre de <strong>{r.hueco.inicio}</strong> a{' '}
                  <strong>{r.hueco.fin}</strong>
                </span>
                <Link
                  to={`/panel/agenda/nuevo?fecha=${dia}&hora=${r.hueco.inicio}`}
                  className="boton-texto enlace-chico"
                  aria-label={`Dar turno a las ${r.hueco.inicio}`}
                >
                  <Plus size={16} aria-hidden="true" /> Dar turno
                </Link>
              </li>
            ) : (
              <li key="ahora" className="marca-ahora">
                <span>Ahora · {r.hora}</span>
              </li>
            ),
          )}
        </ul>
      )}

      {cancelados.length > 0 && (
        <div className="cancelados">
          <button
            type="button"
            className="boton-texto enlace-chico"
            aria-expanded={verCancelados}
            onClick={() => setVerCancelados((v) => !v)}
          >
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

      <p className="solo-lectores" role="status" aria-atomic="true">
        {anuncio}
      </p>
    </>
  )
}
