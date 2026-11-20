import { HandCoins, MessageCircle, Plus, Printer } from 'lucide-react'
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiGet, apiPatch, apiPost } from '../lib/api'
import { leerMonto, MEDIOS_PAGO, MEDIOS_PARA_COBRAR, montoParaEditar, pesos } from '../lib/pagos'
import { puede } from '../lib/permisos'
import {
  estadoPresupuesto,
  fechaPresupuesto,
  numeroPresupuesto,
  rutaPresupuesto,
  tituloCompleto,
  validoHastaTexto,
  whatsappPresupuesto,
} from '../lib/presupuestos'
import { useSitio } from '../lib/sitio'
import type { Mascota, MedioPago, Pago, Presupuesto } from '../types'
import { BotonesComprobante } from './BotonesComprobante'
import { NuevoPresupuesto } from './NuevoPresupuesto'

// Presupuestos en la ficha del cliente: se arma, se manda por WhatsApp y, si acepta, se cobra la seña.
// El día del turno, al cobrarlo, se descuenta solo lo que ya pagó.
export function PresupuestosDelCliente({
  clienteId,
  mascotas,
  alCobrar,
}: {
  clienteId: number
  mascotas: Pick<Mascota, 'id' | 'nombre'>[]
  alCobrar: () => void
}) {
  const { usuario } = useAuth()
  const [lista, setLista] = useState<Presupuesto[] | null>(null)
  const [armando, setArmando] = useState(false)
  const puedeHacer = puede(usuario, 'pagos.cobrar')

  const cargar = useCallback(() => {
    apiGet<Presupuesto[]>(`/presupuestos?clienteId=${clienteId}`)
      .then(setLista)
      .catch(() => setLista([]))
  }, [clienteId])

  useEffect(cargar, [cargar])

  if (!lista) return null
  if (lista.length === 0 && !puedeHacer) return null

  const reemplazar = (p: Presupuesto) => setLista((l) => l?.map((x) => (x.id === p.id ? p : x)) ?? null)
  // Pendientes arriba; los anulados y los ya usados en un turno, guardados en "Anteriores"
  const pendientes = lista.filter((p) => p.estado === 'VIGENTE' && !p.usado)
  const anteriores = lista.filter((p) => p.estado !== 'VIGENTE' || p.usado)

  return (
    <section className="tarjeta bloque-ficha presupuestos" aria-labelledby="titulo-presupuestos">
      <div className="bloque-ficha-titulo">
        <h2 id="titulo-presupuestos">Presupuestos</h2>
        {puedeHacer && !armando && (
          <button type="button" className="boton-fila" onClick={() => setArmando(true)}>
            <Plus size={16} aria-hidden="true" /> Nuevo presupuesto
          </button>
        )}
      </div>

      {armando && (
        <NuevoPresupuesto
          clienteId={clienteId}
          mascotas={mascotas}
          alCancelar={() => setArmando(false)}
          alGuardar={(p) => {
            setLista((l) => [p, ...(l ?? [])])
            setArmando(false)
          }}
        />
      )}

      {pendientes.length === 0 && !armando && (
        <p className="vacio">Para cirugías y limpiezas dentales: se arma, se manda por WhatsApp y se cobra una seña.</p>
      )}
      {pendientes.length > 0 && (
        <ul className="presupuestos-lista">
          {pendientes.map((p) => (
            <TarjetaPresupuesto key={p.id} p={p} alCambiar={reemplazar} alCobrar={alCobrar} />
          ))}
        </ul>
      )}
      {anteriores.length > 0 && (
        <details className="presupuestos-anteriores">
          <summary>Anteriores ({anteriores.length})</summary>
          <ul className="presupuestos-lista">
            {anteriores.map((p) => (
              <TarjetaPresupuesto key={p.id} p={p} alCambiar={reemplazar} alCobrar={alCobrar} />
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function TarjetaPresupuesto({
  p,
  alCambiar,
  alCobrar,
}: {
  p: Presupuesto
  alCambiar: (p: Presupuesto) => void
  alCobrar: () => void
}) {
  const { usuario } = useAuth()
  const { datos: sitio } = useSitio()
  const [modo, setModo] = useState<'nada' | 'cobrar' | 'anular'>('nada')
  const [cobrado, setCobrado] = useState<Pago | null>(null)
  const estado = estadoPresupuesto(p)
  const Icono = estado.icono
  const pendiente = p.estado === 'VIGENTE' && !p.usado
  const puedeCobrar = puede(usuario, 'pagos.cobrar')
  const whatsapp = sitio && pendiente ? whatsappPresupuesto(p, sitio.clinica) : null

  async function actualizar() {
    alCambiar(await apiGet<Presupuesto>(`/presupuestos/${p.id}`))
  }

  return (
    <li className={`presupuesto presupuesto-${estado.clase}`}>
      <div className="presupuesto-cabeza">
        <div className="presupuesto-nombre">
          <strong>{tituloCompleto(p)}</strong>
          <span>
            {numeroPresupuesto(p)} · {fechaPresupuesto(p)} · vale hasta el {validoHastaTexto(p)}
          </span>
        </div>
        <span className={`estado-presupuesto ${estado.clase}`}>
          <Icono size={16} aria-hidden="true" /> {estado.texto}
        </span>
      </div>

      <table className="presupuesto-items">
        <caption className="solo-lectores">Qué incluye</caption>
        <tbody>
          {p.items.map((i) => (
            <tr key={i.id}>
              <td>{i.descripcion}</td>
              <td>{pesos(i.monto)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{pesos(p.total)}</td>
          </tr>
          {p.pagado > 0 && (
            <>
              <tr className="presupuesto-pagado">
                <th scope="row">Pagado</th>
                <td>{pesos(p.pagado)}</td>
              </tr>
              <tr className="presupuesto-falta">
                <th scope="row">Falta</th>
                <td>{pesos(p.falta)}</td>
              </tr>
            </>
          )}
        </tfoot>
      </table>
      {p.nota && <p className="presupuesto-nota">{p.nota}</p>}
      {p.estado === 'ANULADO' && (
        <p className="ayuda">
          Anulado{p.anuladoPor ? ` por ${p.anuladoPor.nombre}` : ''}: {p.motivoAnulacion}
        </p>
      )}
      {p.estado === 'VIGENTE' && p.usado && <p className="ayuda">Ya se cobró el turno con este presupuesto.</p>}
      {pendiente && p.pagado > 0 && p.falta > 0 && (
        <p className="ayuda">Lo que falta se cobra el día del turno (aparece solo en "Por cobrar").</p>
      )}

      {cobrado && (
        <div className="mensaje-exito presupuesto-cobrado" role="status">
          <span>
            Listo: {pesos(cobrado.monto)} en {MEDIOS_PAGO[cobrado.medio].texto.toLowerCase()}.
          </span>
          <BotonesComprobante pago={cobrado} />
        </div>
      )}

      {modo === 'cobrar' && (
        <CobrarSena
          p={p}
          alCancelar={() => setModo('nada')}
          alCobrar={async (pago) => {
            setCobrado(pago)
            setModo('nada')
            alCobrar()
            await actualizar()
          }}
        />
      )}
      {modo === 'anular' && (
        <AnularPresupuesto
          p={p}
          alCancelar={() => setModo('nada')}
          alAnular={(nuevo) => {
            setModo('nada')
            alCambiar(nuevo)
          }}
        />
      )}

      {pendiente && modo === 'nada' && (
        <div className="presupuesto-acciones">
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="boton-fila boton-fila-whatsapp"
            >
              <MessageCircle size={16} aria-hidden="true" /> Mandar por WhatsApp
            </a>
          )}
          {puedeCobrar && p.falta > 0 && (
            <button type="button" className="boton-fila" onClick={() => setModo('cobrar')}>
              <HandCoins size={16} aria-hidden="true" /> {p.pagado === 0 ? 'Cobrar seña' : 'Cobrar a cuenta'}
            </button>
          )}
          <a href={rutaPresupuesto(p, true)} target="_blank" rel="noreferrer" className="boton-fila">
            <Printer size={16} aria-hidden="true" /> Imprimir presupuesto
          </a>
          {puedeCobrar && p.pagado === 0 && (
            <button type="button" className="boton-texto" onClick={() => setModo('anular')}>
              Anular
            </button>
          )}
        </div>
      )}
    </li>
  )
}

// La seña (o un pago a cuenta): un toque para la mitad o para todo lo que falta.
function CobrarSena({
  p,
  alCobrar,
  alCancelar,
}: {
  p: Presupuesto
  alCobrar: (pago: Pago) => void
  alCancelar: () => void
}) {
  const id = useId()
  const mitad = Math.round(p.falta / 2 / 100) * 100
  const [monto, setMonto] = useState('')
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const valor = leerMonto(monto)

  async function cobrar(e: FormEvent) {
    e.preventDefault()
    if (!valor) return setError('Escribí el monto')
    if (valor > p.falta) return setError(`Falta pagar ${pesos(p.falta)}`)
    setGuardando(true)
    setError(null)
    try {
      alCobrar(await apiPost<Pago>('/pagos', { presupuestoId: p.id, monto: valor, medio }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el cobro')
      setGuardando(false)
    }
  }

  return (
    <form className="presupuesto-formulario" onSubmit={cobrar}>
      <div className="presupuesto-sena-monto">
        <label className="cobro-monto" htmlFor={`${id}-monto`}>
          <span>{p.pagado === 0 ? 'Seña' : 'A cuenta'}</span>
          <span className="cobro-monto-campo">
            <span aria-hidden="true">$</span>
            <input
              id={`${id}-monto`}
              inputMode="decimal"
              autoComplete="off"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              aria-invalid={!!error}
              autoFocus
            />
          </span>
        </label>
        {mitad > 0 && mitad < p.falta && (
          <button type="button" className="chip" onClick={() => setMonto(montoParaEditar(mitad))}>
            La mitad · {pesos(mitad)}
          </button>
        )}
        <button type="button" className="chip" onClick={() => setMonto(montoParaEditar(p.falta))}>
          Todo · {pesos(p.falta)}
        </button>
      </div>
      <fieldset className="cobro-medios">
        <legend>Cómo pagó</legend>
        {MEDIOS_PARA_COBRAR.map((m) => {
          const IconoMedio = MEDIOS_PAGO[m].icono
          return (
            <button
              key={m}
              type="button"
              className={`chip cobro-medio${medio === m ? ' chip-activo' : ''}`}
              aria-pressed={medio === m}
              onClick={() => setMedio(m)}
            >
              <IconoMedio size={16} aria-hidden="true" /> {MEDIOS_PAGO[m].texto}
            </button>
          )
        })}
      </fieldset>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <div className="formulario-botones">
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : valor ? `Cobrar ${pesos(valor)}` : 'Cobrar'}
        </button>
        <button type="button" className="boton-texto" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function AnularPresupuesto({
  p,
  alAnular,
  alCancelar,
}: {
  p: Presupuesto
  alAnular: (p: Presupuesto) => void
  alCancelar: () => void
}) {
  const id = useId()
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function anular(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      alAnular(await apiPatch<Presupuesto>(`/presupuestos/${p.id}/anular`, { motivo }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anular')
      setGuardando(false)
    }
  }

  return (
    <form className="presupuesto-formulario" onSubmit={anular}>
      <label className="campo" htmlFor={`${id}-motivo`}>
        Por qué se anula
        <input
          id={`${id}-motivo`}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          required
          minLength={3}
          maxLength={190}
          placeholder="Ej.: No va a hacer la cirugía"
          autoComplete="off"
          autoFocus
        />
      </label>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <div className="formulario-botones">
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Anulando…' : 'Anular presupuesto'}
        </button>
        <button type="button" className="boton-texto" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
