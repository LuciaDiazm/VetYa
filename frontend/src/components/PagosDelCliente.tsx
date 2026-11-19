import { CircleAlert } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import { pesos } from '../lib/pagos'
import type { ListaPagos, TurnoPorCobrar } from '../types'
import { CobrarTurno } from './CobrarTurno'
import { OtroCobro } from './OtroCobro'
import { Paginacion } from './Paginacion'
import { TablaPagos } from './TablaPagos'

const POR_PAGINA = 10

// Pagos en la ficha del cliente: lo que debe (turnos atendidos sin cobrar) y lo que pagó.
export function PagosDelCliente({ clienteId }: { clienteId: number }) {
  const [deuda, setDeuda] = useState<TurnoPorCobrar[] | null>(null)
  const [lista, setLista] = useState<ListaPagos | null>(null)
  const [cobrados, setCobrados] = useState<Set<number>>(() => new Set())
  const [pagina, setPagina] = useState(1)

  const cargarLista = useCallback(() => {
    apiGet<ListaPagos>(`/pagos?clienteId=${clienteId}`)
      .then(setLista)
      .catch(() => {})
  }, [clienteId])

  useEffect(() => {
    apiGet<TurnoPorCobrar[]>(`/pagos/por-cobrar?clienteId=${clienteId}`)
      .then(setDeuda)
      .catch(() => setDeuda([]))
    cargarLista()
  }, [clienteId, cargarLista])

  if (!deuda || !lista) return null
  const faltan = deuda.filter((t) => !cobrados.has(t.id))
  const montoDeuda = faltan.reduce((s, t) => s + (t.servicio.precioReferencia ?? 0), 0)
  const paginaReal = Math.min(pagina, Math.max(1, Math.ceil(lista.pagos.length / POR_PAGINA)))

  function marcar(id: number, cobrado: boolean) {
    setCobrados((antes) => {
      const nuevos = new Set(antes)
      if (cobrado) nuevos.add(id)
      else nuevos.delete(id)
      return nuevos
    })
    cargarLista()
  }

  return (
    <section className="tarjeta bloque-ficha pagos-cliente" aria-labelledby="titulo-pagos-cliente">
      <div className="bloque-ficha-titulo">
        <h2 id="titulo-pagos-cliente">Pagos</h2>
        {lista.cantidad > 0 && (
          <span className="ayuda">
            Pagó {pesos(lista.total)} en {lista.cantidad} {lista.cantidad === 1 ? 'cobro' : 'cobros'}
          </span>
        )}
      </div>

      {faltan.length > 0 && (
        <p className="pagos-cliente-deuda">
          <CircleAlert size={20} aria-hidden="true" />
          Le falta pagar {faltan.length === 1 ? '1 turno' : `${faltan.length} turnos`}
          {montoDeuda > 0 && ` · ${pesos(montoDeuda)}`}
        </p>
      )}
      {deuda.length > 0 && (
        <ul className="cobros pagos-cliente-cobros">
          {deuda.map((t) => (
            <CobrarTurno key={t.id} turno={t} conCliente={false} alCambiar={(c) => marcar(t.id, c)} />
          ))}
        </ul>
      )}

      {lista.pagos.length === 0 ? (
        <p className="vacio">Todavía no tiene pagos registrados.</p>
      ) : (
        <>
          <TablaPagos
            pagos={lista.pagos}
            conCliente={false}
            alCambiar={cargarLista}
            desde={(paginaReal - 1) * POR_PAGINA}
            hasta={paginaReal * POR_PAGINA}
          />
          <Paginacion pagina={paginaReal} total={lista.pagos.length} porPagina={POR_PAGINA} queSeCuenta="pagos" alCambiar={setPagina} />
        </>
      )}

      <div className="pagos-cliente-pie">
        <OtroCobro clienteId={clienteId} alGuardar={cargarLista} />
      </div>
    </section>
  )
}
