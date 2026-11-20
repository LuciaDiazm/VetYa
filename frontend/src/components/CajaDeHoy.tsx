import { HandCoins } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../lib/api'
import { puede } from '../lib/permisos'
import { MEDIOS_PAGO, MEDIOS_PARA_COBRAR, pesos } from '../lib/pagos'
import type { ResumenCaja } from '../types'

const CADA_CUANTO = 60_000

// "Caja de hoy" en la pantalla Hoy: lo cobrado hoy y lo que falta cobrar.
// Se actualiza sola cada minuto y cada vez que cambia algún turno del día (por ejemplo, al marcar "Vino").
export function CajaDeHoy({ version }: { version: string }) {
  const { usuario } = useAuth()
  const [caja, setCaja] = useState<ResumenCaja | null>(null)

  useEffect(() => {
    const consultar = () =>
      apiGet<ResumenCaja>('/pagos/resumen-hoy')
        .then(setCaja)
        .catch(() => {})
    consultar()
    const reloj = setInterval(consultar, CADA_CUANTO)
    return () => clearInterval(reloj)
  }, [version])

  if (!caja) return null
  const medios = MEDIOS_PARA_COBRAR.filter((m) => caja.porMedio[m] > 0)

  return (
    <section className="hoy-caja caja-de-hoy" aria-labelledby="titulo-caja-hoy">
      <div className="hoy-caja-titulo">
        <h2 id="titulo-caja-hoy">
          <HandCoins size={22} aria-hidden="true" /> Caja de hoy
        </h2>
      </div>
      <div className="caja-de-hoy-cuerpo">
        <p className="caja-de-hoy-total">
          <strong>{pesos(caja.total)}</strong>
          <span>
            cobrado · {caja.cantidad} {caja.cantidad === 1 ? 'cobro' : 'cobros'}
          </span>
        </p>
        {medios.length > 0 && (
          <ul className="caja-de-hoy-medios">
            {medios.map((m) => (
              <li key={m}>
                <span>{MEDIOS_PAGO[m].texto}</span>
                <strong>{pesos(caja.porMedio[m])}</strong>
              </li>
            ))}
          </ul>
        )}
        {caja.porCobrar > 0 && !puede(usuario, 'pagos.cobrar') ? (
          // La veterinaria o el veterinario no cobra: ve lo que falta, sin el botón.
          <p className="caja-de-hoy-nada">
            Por cobrar: {caja.porCobrar} {caja.porCobrar === 1 ? 'turno' : 'turnos'}
            {caja.montoPorCobrar > 0 && ` · ${pesos(caja.montoPorCobrar)}`}. Los cobra recepción.
          </p>
        ) : caja.porCobrar > 0 ? (
          <Link to="/panel/pagos" className="boton caja-de-hoy-boton">
            Cobrar {caja.porCobrar} {caja.porCobrar === 1 ? 'turno' : 'turnos'}
            {caja.montoPorCobrar > 0 && ` · ${pesos(caja.montoPorCobrar)}`}
          </Link>
        ) : (
          <p className="caja-de-hoy-nada">No queda nada por cobrar.</p>
        )}
      </div>
    </section>
  )
}
