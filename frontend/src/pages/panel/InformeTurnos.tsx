import { Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ElegirFechas } from '../../components/ElegirFechas'
import { apiGet } from '../../lib/api'
import { diaDe, horaDe, hoyArgentina, lunesDe, primeroDeMes, problemaDePeriodo, sumarDias } from '../../lib/fechas'
import { useSitio } from '../../lib/sitio'
import { ESTADOS_TURNO, ICONOS_ESTADO, ORIGENES } from '../../lib/turnos'
import type { EstadoTurno, OrigenTurno } from '../../types'
import { Cargando } from '../../components/Cargando'
import { Paginacion } from '../../components/Paginacion'

interface TurnoInforme {
  id: number
  fechaHoraInicio: string
  estado: EstadoTurno
  origen: OrigenTurno
  servicio: { id: number; nombre: string }
  veterinario: { id: number; nombre: string; apellido: string } | null
  mascota: { nombre: string; cliente: { nombre: string; apellido: string } }
}

const ultimoDeMes = (f: string) => sumarDias(primeroDeMes(sumarDias(primeroDeMes(f), 32)), -1)

// Atajos para no tener que escribir las fechas.
const ATAJOS = [
  { nombre: 'Hoy', rango: (hoy: string) => [hoy, hoy] },
  { nombre: 'Esta semana', rango: (hoy: string) => [lunesDe(hoy), sumarDias(lunesDe(hoy), 5)] },
  { nombre: 'Este mes', rango: (hoy: string) => [primeroDeMes(hoy), ultimoDeMes(hoy)] },
  {
    nombre: 'Mes pasado',
    rango: (hoy: string) => {
      const ultimo = sumarDias(primeroDeMes(hoy), -1)
      return [primeroDeMes(ultimo), ultimo]
    },
  },
]

const ESTADOS_FILTRO = [
  ['', 'Todos'],
  ['ATENDIDO', 'Atendidos'],
  ['AUSENTE', 'No vinieron'],
  ['CANCELADO', 'Cancelados'],
  ['POR_VENIR', 'Por venir'],
] as const

const porVenir = (e: EstadoTurno) => e === 'PENDIENTE' || e === 'CONFIRMADO'
const SEMANA = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' })
const FECHA_LARGA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const aFecha = (f: string) => new Date(`${f}T12:00:00Z`)
// "2026-10-05" → "lun 05/10"
const fechaCorta = (f: string) => `${SEMANA.format(aFecha(f)).replace('.', '')} ${f.slice(8)}/${f.slice(5, 7)}`
const nombreVet = (v: TurnoInforme['veterinario']) => (v ? `${v.nombre} ${v.apellido}` : 'Sin asignar')

const TURNOS_POR_PAGINA = 20

// Informe de turnos: todos los turnos entre dos fechas, con filtros, totales y para imprimir.
export function InformeTurnos() {
  const { datos: sitio } = useSitio()
  const [parametros, setParametros] = useSearchParams()
  const [hoy] = useState(hoyArgentina)
  const [semanaDesde, semanaHasta] = ATAJOS[1].rango(hoy)
  const desde = parametros.get('desde') ?? semanaDesde
  const hasta = parametros.get('hasta') ?? semanaHasta
  const estado = parametros.get('estado') ?? ''
  const servicio = parametros.get('servicio') ?? ''
  const veterinario = parametros.get('veterinario') ?? ''
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1)
  const problema = problemaDePeriodo(desde, hasta)

  // Se guarda para qué fechas es cada respuesta: si no coinciden con las elegidas, se está consultando.
  const [resultado, setResultado] = useState<{ periodo: string; turnos: TurnoInforme[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const turnos = resultado?.turnos ?? null
  const consultando = !problema && !error && resultado !== null && resultado.periodo !== `${desde}|${hasta}`

  useEffect(() => {
    if (problema) return
    let vigente = true
    apiGet<TurnoInforme[]>(`/estadisticas/turnos?desde=${desde}&hasta=${hasta}`)
      .then((t) => {
        if (!vigente) return
        setResultado({ periodo: `${desde}|${hasta}`, turnos: t })
        setError(null)
      })
      .catch(() => vigente && setError('No se pudo cargar el informe.'))
    return () => {
      vigente = false
    }
  }, [desde, hasta, problema])

  // Cambia un filtro y mantiene los demás (quedan en la dirección, así se puede recargar o imprimir igual).
  // Cualquier filtro nuevo vuelve a la página 1.
  function cambiar(valores: Record<string, string>) {
    const nuevos = new URLSearchParams(parametros)
    nuevos.delete('pagina')
    for (const [clave, valor] of Object.entries(valores)) {
      if (valor) nuevos.set(clave, valor)
      else nuevos.delete(clave)
    }
    setParametros(nuevos, { replace: true })
  }

  function irAPagina(nueva: number) {
    const nuevos = new URLSearchParams(parametros)
    nuevos.set('pagina', String(nueva))
    setParametros(nuevos)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // Opciones de los filtros: solo lo que aparece en el período.
  const servicios = useMemo(
    () => [...new Map((turnos ?? []).map((t) => [t.servicio.id, t.servicio.nombre]))].sort((a, b) => a[1].localeCompare(b[1])),
    [turnos],
  )
  const veterinarios = useMemo(
    () =>
      [...new Map((turnos ?? []).map((t) => [t.veterinario ? String(t.veterinario.id) : 'sin', nombreVet(t.veterinario)]))].sort(
        (a, b) => a[1].localeCompare(b[1]),
      ),
    [turnos],
  )

  const filtrados = (turnos ?? []).filter(
    (t) =>
      (!estado || (estado === 'POR_VENIR' ? porVenir(t.estado) : t.estado === estado)) &&
      (!servicio || String(t.servicio.id) === servicio) &&
      (!veterinario || (t.veterinario ? String(t.veterinario.id) : 'sin') === veterinario),
  )
  // Si la página de la dirección ya no existe (por ejemplo, después de filtrar), se muestra la última.
  const paginaReal = Math.min(pagina, Math.max(1, Math.ceil(filtrados.length / TURNOS_POR_PAGINA)))
  const cuenta = (condicion: (t: TurnoInforme) => boolean) => filtrados.filter(condicion).length
  const totales = [
    ['Turnos', filtrados.length],
    ['Atendidos', cuenta((t) => t.estado === 'ATENDIDO')],
    ['No vinieron', cuenta((t) => t.estado === 'AUSENTE')],
    ['Cancelados', cuenta((t) => t.estado === 'CANCELADO')],
    ['Por venir', cuenta((t) => porVenir(t.estado))],
  ] as const

  const filtrosAplicados = [
    estado && ESTADOS_FILTRO.find(([v]) => v === estado)?.[1],
    servicio && servicios.find(([id]) => String(id) === servicio)?.[1],
    veterinario && veterinarios.find(([id]) => id === veterinario)?.[1],
  ].filter(Boolean)

  return (
    <>
      {/* Encabezado que solo sale en el papel */}
      <div className="solo-impresion">
        <strong>{sitio?.clinica.nombre}</strong>
        <h1>Informe de turnos</h1>
        <p>
          Del {FECHA_LARGA.format(aFecha(desde))} al {FECHA_LARGA.format(aFecha(hasta))}
          {filtrosAplicados.length > 0 && ` · ${filtrosAplicados.join(' · ')}`}
        </p>
        <p>Impreso el {FECHA_LARGA.format(aFecha(hoy))}</p>
      </div>

      <div className="panel-encabezado no-imprimir">
        <h1>Informe de turnos</h1>
        <p>Todos los turnos entre dos fechas. Podés filtrarlos e imprimirlos.</p>
      </div>

      <section className="tarjeta informe-filtros no-imprimir" aria-label="Filtros del informe">
        <div className="filtro-periodo" role="group" aria-label="Atajos de fechas">
          {ATAJOS.map((a) => {
            const [d, h] = a.rango(hoy)
            const activo = d === desde && h === hasta
            return (
              <button
                key={a.nombre}
                type="button"
                className={`chip${activo ? ' chip-activo' : ''}`}
                aria-pressed={activo}
                onClick={() => cambiar({ desde: d, hasta: h })}
              >
                {a.nombre}
              </button>
            )
          })}
        </div>
        <div className="informe-campos">
          <ElegirFechas desde={desde} hasta={hasta} alCambiar={(d, h) => cambiar({ desde: d, hasta: h })} />
          <label className="campo">
            Estado
            <select value={estado} onChange={(e) => cambiar({ estado: e.target.value })}>
              {ESTADOS_FILTRO.map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Servicio
            <select value={servicio} onChange={(e) => cambiar({ servicio: e.target.value })}>
              <option value="">Todos</option>
              {servicios.map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Veterinario
            <select value={veterinario} onChange={(e) => cambiar({ veterinario: e.target.value })}>
              <option value="">Todos</option>
              {veterinarios.map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="boton boton-contorno" onClick={() => window.print()} disabled={!filtrados.length}>
          <Printer size={20} aria-hidden="true" /> Imprimir o guardar en PDF
        </button>
      </section>

      {problema && <p className="mensaje-error">{problema}</p>}
      {error && <p className="mensaje-error">{error}</p>}
      {!problema && !turnos && !error && <Cargando />}

      {!problema && turnos && (
        <>
          {/* Al cambiar las fechas: el anillo flota sobre el informe anterior, más tenue */}
          {consultando && (
            <div className="cargando-flotante">
              <Cargando texto="Consultando…" />
            </div>
          )}
          <div className={consultando ? 'recargando' : undefined} aria-busy={consultando}>
          <ul className="informe-totales">
            {totales.map(([texto, valor]) => (
              <li key={texto} className="tarjeta">
                <strong>{valor}</strong>
                {texto}
              </li>
            ))}
          </ul>

          <section className="tarjeta">
            {filtrados.length === 0 ? (
              <p className="vacio">No hay turnos con estos filtros.</p>
            ) : (
              <table className="informe-tabla">
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Hora</th>
                    <th scope="col">Mascota</th>
                    <th scope="col">Dueño</th>
                    <th scope="col">Servicio</th>
                    <th scope="col">Veterinario</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Cómo se pidió</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((t, i) => {
                    const Icono = ICONOS_ESTADO[t.estado]
                    // En pantalla se ven de a 20; al imprimir salen todos (ver .fuera-de-pagina)
                    const enLaPagina = i >= (paginaReal - 1) * TURNOS_POR_PAGINA && i < paginaReal * TURNOS_POR_PAGINA
                    return (
                      <tr key={t.id} className={enLaPagina ? undefined : 'fuera-de-pagina'}>
                        <td className="informe-fecha">{fechaCorta(diaDe(t.fechaHoraInicio))}</td>
                        <td>{horaDe(t.fechaHoraInicio)}</td>
                        <td data-etiqueta="Mascota">{t.mascota.nombre}</td>
                        <td data-etiqueta="Dueño">
                          {t.mascota.cliente.nombre} {t.mascota.cliente.apellido}
                        </td>
                        <td data-etiqueta="Servicio">{t.servicio.nombre}</td>
                        <td data-etiqueta="Veterinario">{nombreVet(t.veterinario)}</td>
                        <td data-etiqueta="Estado">
                          <span className={`informe-estado estado-${t.estado.toLowerCase()}`}>
                            <Icono size={16} aria-hidden="true" /> {ESTADOS_TURNO[t.estado]}
                          </span>
                        </td>
                        <td data-etiqueta="Cómo se pidió">{ORIGENES[t.origen].texto}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <Paginacion
              pagina={paginaReal}
              total={filtrados.length}
              porPagina={TURNOS_POR_PAGINA}
              queSeCuenta="turnos"
              alCambiar={irAPagina}
            />
          </section>
          </div>
        </>
      )}
    </>
  )
}
