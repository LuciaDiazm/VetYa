import { FileDown, FileSpreadsheet, HandCoins, Printer, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Ayuda } from '../../components/Ayuda'
import { Cargando } from '../../components/Cargando'
import { CobrarTurno } from '../../components/CobrarTurno'
import { ElegirFechas } from '../../components/ElegirFechas'
import { OtroCobro } from '../../components/OtroCobro'
import { Paginacion } from '../../components/Paginacion'
import { TablaPagos } from '../../components/TablaPagos'
import { apiDescargar, apiGet } from '../../lib/api'
import { descargarPlanilla } from '../../lib/descargas'
import { diaCorto, diaDe, horaDe, hoyArgentina, lunesDe, primeroDeMes, problemaDePeriodo, sumarDias } from '../../lib/fechas'
import { MEDIOS_PAGO, MEDIOS_PARA_COBRAR, pesos } from '../../lib/pagos'
import { useSitio } from '../../lib/sitio'
import type { ListaPagos, MedioPago, Pago, TurnoPorCobrar } from '../../types'

const PAGOS_POR_PAGINA = 20
const CADA_CUANTO = 60_000 // se actualiza solo cada minuto (por si cobran o atienden en otra compu)
const FECHA_LARGA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const aFecha = (f: string) => new Date(`${f}T12:00:00Z`)
const fechaPlanilla = (f: string) => `${f.slice(8)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
const nombre = (p: { nombre: string; apellido: string } | null) => (p ? `${p.nombre} ${p.apellido}` : 'Mostrador')
const COLUMNAS = ['Fecha', 'Hora', 'Cliente', 'Concepto', 'Medio', 'Monto', 'Registró', 'Estado']

// Una fila como texto, igual que en la tabla (para el PDF y la planilla).
function filaDeTexto(p: Pago, fecha: (f: string) => string, monto: (m: number) => string | number) {
  return [
    fecha(diaDe(p.fecha)),
    horaDe(p.fecha),
    nombre(p.cliente),
    p.concepto,
    MEDIOS_PAGO[p.medio].texto,
    monto(p.monto),
    nombre(p.registradoPor),
    p.anulado ? `Anulado: ${p.motivoAnulacion ?? ''}` : 'Cobrado',
  ] as (string | number)[]
}

// Pagos: lo que falta cobrar (los turnos atendidos, con el precio ya puesto) y la caja entre dos fechas.
export function Pagos() {
  const { datos: sitio } = useSitio()
  const [parametros, setParametros] = useSearchParams()
  const [hoy] = useState(hoyArgentina)
  const desde = parametros.get('desde') ?? hoy
  const hasta = parametros.get('hasta') ?? desde
  const medio = (parametros.get('medio') ?? '') as MedioPago | ''
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1)
  const problema = problemaDePeriodo(desde, hasta)

  const [porCobrar, setPorCobrar] = useState<TurnoPorCobrar[] | null>(null)
  // Los que se cobraron en esta pantalla (siguen a la vista con "Deshacer", pero ya no se cuentan)
  const [cobrados, setCobrados] = useState<Set<number>>(() => new Set())
  const [lista, setLista] = useState<{ periodo: string; datos: ListaPagos } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [armandoPdf, setArmandoPdf] = useState(false)
  const [errorPdf, setErrorPdf] = useState<string | null>(null)
  const periodo = `${desde}|${hasta}`
  const consultando = !problema && lista !== null && lista.periodo !== periodo

  // Por cobrar: al actualizarse solo se suman los turnos nuevos; los que ya se cobraron en esta
  // pantalla quedan a la vista (con "Deshacer") hasta salir.
  const cargarPorCobrar = useCallback(() => {
    apiGet<TurnoPorCobrar[]>('/pagos/por-cobrar')
      .then((nuevos) =>
        setPorCobrar((antes) =>
          antes === null
            ? nuevos
            : [...nuevos.filter((n) => !antes.some((a) => a.id === n.id)), ...antes].sort((a, b) =>
                b.fechaHoraInicio.localeCompare(a.fechaHoraInicio),
              ),
        ),
      )
      .catch(() => setPorCobrar((antes) => antes ?? []))
  }, [])

  const cargarLista = useCallback(() => {
    if (problema) return
    apiGet<ListaPagos>(`/pagos?desde=${desde}&hasta=${hasta}`)
      .then((datos) => {
        setLista({ periodo: `${desde}|${hasta}`, datos })
        setError(null)
      })
      .catch(() => setError('No se pudieron cargar los pagos.'))
  }, [desde, hasta, problema])

  useEffect(() => {
    cargarPorCobrar()
    const reloj = setInterval(cargarPorCobrar, CADA_CUANTO)
    return () => clearInterval(reloj)
  }, [cargarPorCobrar])

  useEffect(() => {
    cargarLista()
    const reloj = setInterval(cargarLista, CADA_CUANTO)
    return () => clearInterval(reloj)
  }, [cargarLista])

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
  }

  const pagos = (lista?.datos.pagos ?? []).filter((p) => !medio || p.medio === medio)
  const validos = pagos.filter((p) => !p.anulado)
  const total = validos.reduce((s, p) => s + p.monto, 0)
  const porMedio = (m: MedioPago) => validos.filter((p) => p.medio === m).reduce((s, p) => s + p.monto, 0)
  const paginaReal = Math.min(pagina, Math.max(1, Math.ceil(pagos.length / PAGOS_POR_PAGINA)))

  // Atajos de período: una sola acción para lo que más se mira.
  const atajos = [
    ['Hoy', hoy, hoy],
    ['Ayer', sumarDias(hoy, -1), sumarDias(hoy, -1)],
    ['Esta semana', lunesDe(hoy), hoy],
    ['Este mes', primeroDeMes(hoy), hoy],
  ] as const

  const periodoEscrito =
    desde === hasta ? FECHA_LARGA.format(aFecha(desde)) : `Del ${FECHA_LARGA.format(aFecha(desde))} al ${FECHA_LARGA.format(aFecha(hasta))}`
  const subtitulo = [periodoEscrito, medio && MEDIOS_PAGO[medio].texto].filter(Boolean).join(' · ')
  const resumen = [
    `Total cobrado: ${pesos(total)}`,
    `${validos.length} ${validos.length === 1 ? 'cobro' : 'cobros'}`,
    ...MEDIOS_PARA_COBRAR.filter((m) => porMedio(m) > 0).map((m) => `${MEDIOS_PAGO[m].texto} ${pesos(porMedio(m))}`),
  ].join('   ·   ')
  const nombreArchivo = `pagos-${desde}-al-${hasta}`
  const faltan = (porCobrar ?? []).filter((t) => !cobrados.has(t.id))
  const sumaPorCobrar = faltan.reduce((s, t) => s + (t.servicio.precioReferencia ?? 0), 0)

  function marcarCobrado(id: number, cobrado: boolean) {
    setCobrados((antes) => {
      const nuevos = new Set(antes)
      if (cobrado) nuevos.add(id)
      else nuevos.delete(id)
      return nuevos
    })
    cargarLista()
  }

  function bajarExcel() {
    descargarPlanilla(
      [COLUMNAS, ...pagos.map((p) => filaDeTexto(p, fechaPlanilla, (m) => String(m).replace('.', ',')))],
      `${nombreArchivo}.csv`,
    )
  }

  async function bajarPdf() {
    setArmandoPdf(true)
    setErrorPdf(null)
    try {
      await apiDescargar(
        '/pagos/informe.pdf',
        { subtitulo, resumen, filas: pagos.map((p) => filaDeTexto(p, diaCorto, pesos).map(String)) },
        `${nombreArchivo}.pdf`,
      )
    } catch {
      setErrorPdf('No se pudo armar el PDF. Probá de nuevo o usá Imprimir.')
    } finally {
      setArmandoPdf(false)
    }
  }

  return (
    <>
      <div className="solo-impresion">
        <strong>{sitio?.clinica.nombre}</strong>
        <h1>Informe de pagos</h1>
        <p>{subtitulo}</p>
        <p>{resumen}</p>
      </div>

      <div className="informe-encabezado no-imprimir">
        <h1>Pagos</h1>
        <Ayuda
          etiqueta="Cómo funcionan los pagos"
          texto="Cuando un turno se marca como atendido, aparece en Por cobrar con el precio del servicio. Elegí cómo pagó y tocá Cobrar. Abajo está la caja: lo cobrado entre dos fechas, para bajar en Excel o PDF."
        />
      </div>

      {/* ---------- Por cobrar ---------- */}
      <section className="hoy-caja por-cobrar no-imprimir" aria-labelledby="titulo-por-cobrar">
        <div className="hoy-caja-titulo">
          <h2 id="titulo-por-cobrar">
            <HandCoins size={22} aria-hidden="true" /> Por cobrar
          </h2>
          {porCobrar && porCobrar.length > 0 && (
            <span className="hoy-faltan">
              {faltan.length === 0 ? (
                'Ya cobraste todos'
              ) : (
                <>
                  Faltan <strong>{faltan.length}</strong>
                  {sumaPorCobrar > 0 && <> · {pesos(sumaPorCobrar)}</>}
                </>
              )}
            </span>
          )}
        </div>
        {porCobrar === null ? (
          <Cargando />
        ) : porCobrar.length === 0 ? (
          <p className="hoy-vacio">No hay nada por cobrar. Cuando marques un turno como atendido, aparece acá con su precio.</p>
        ) : (
          <ul className="cobros">
            {porCobrar.map((t) => (
              <CobrarTurno key={t.id} turno={t} alCambiar={(c) => marcarCobrado(t.id, c)} />
            ))}
          </ul>
        )}
        <div className="por-cobrar-pie">
          <OtroCobro alGuardar={cargarLista} />
        </div>
      </section>

      {/* ---------- Caja: lo cobrado entre dos fechas ---------- */}
      <div className="informe-encabezado caja-encabezado no-imprimir">
        <h2>
          <Wallet size={22} aria-hidden="true" /> Caja
        </h2>
        <div className="informe-acciones" role="group" aria-label="Bajar o imprimir los pagos">
          <button type="button" className="informe-accion" onClick={bajarExcel} disabled={!pagos.length}>
            <FileSpreadsheet size={20} aria-hidden="true" /> Excel
          </button>
          <button type="button" className="informe-accion" onClick={() => window.print()} disabled={!pagos.length}>
            <Printer size={20} aria-hidden="true" /> Imprimir
          </button>
          <button type="button" className="informe-accion" onClick={bajarPdf} disabled={!pagos.length || armandoPdf}>
            <FileDown size={20} aria-hidden="true" /> {armandoPdf ? 'Armando…' : 'PDF'}
          </button>
        </div>
      </div>
      {errorPdf && (
        <p className="mensaje-error no-imprimir" role="alert">
          {errorPdf}
        </p>
      )}

      <div className="informe-caja">
        <section className="informe-filtros no-imprimir" aria-label="Período y medio de pago">
          <div className="chips chips-chicas caja-atajos">
            {atajos.map(([texto, d, h]) => (
              <button
                key={texto}
                type="button"
                className={`chip${desde === d && hasta === h ? ' chip-activo' : ''}`}
                aria-pressed={desde === d && hasta === h}
                onClick={() => cambiar({ desde: d === hoy && h === hoy ? '' : d, hasta: d === h ? '' : h })}
              >
                {texto}
              </button>
            ))}
          </div>
          <div className="informe-campos">
            <ElegirFechas compacto desde={desde} hasta={hasta} alCambiar={(d, h) => cambiar({ desde: d, hasta: h })} />
            <label className="campo-compacto">
              <span>Medio</span>
              <select value={medio} onChange={(e) => cambiar({ medio: e.target.value })}>
                <option value="">Todos</option>
                {(Object.keys(MEDIOS_PAGO) as MedioPago[]).map((m) => (
                  <option key={m} value={m}>
                    {MEDIOS_PAGO[m].texto}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {problema && <p className="mensaje-error">{problema}</p>}
        {error && <p className="mensaje-error">{error}</p>}
        {!problema && !lista && !error && <Cargando />}

        {!problema && lista && (
          <div className={consultando ? 'recargando' : undefined} aria-busy={consultando}>
            <ul className="informe-totales caja-totales">
              <li className="caja-total">
                <strong>{pesos(total)}</strong>
                Total cobrado
              </li>
              {MEDIOS_PARA_COBRAR.map((m) => (
                <li key={m}>
                  <strong>{pesos(porMedio(m))}</strong>
                  {MEDIOS_PAGO[m].texto}
                </li>
              ))}
            </ul>

            <section className="informe-resultado">
              {pagos.length === 0 ? (
                <p className="vacio">No hay pagos en estas fechas.</p>
              ) : (
                <TablaPagos
                  pagos={pagos}
                  alCambiar={() => {
                    cargarLista()
                    cargarPorCobrar()
                  }}
                  desde={(paginaReal - 1) * PAGOS_POR_PAGINA}
                  hasta={paginaReal * PAGOS_POR_PAGINA}
                />
              )}
              <Paginacion
                pagina={paginaReal}
                total={pagos.length}
                porPagina={PAGOS_POR_PAGINA}
                queSeCuenta="pagos"
                alCambiar={irAPagina}
              />
            </section>
          </div>
        )}
      </div>
    </>
  )
}
