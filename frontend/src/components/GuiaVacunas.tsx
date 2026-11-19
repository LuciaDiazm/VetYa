import { CalendarHeart } from 'lucide-react'
import { edadDosis } from '../lib/sanitario'
import type { EspecieMascota, PlanSanitario } from '../types'

// Calendario de vacunas del primer año (cachorro y gatito), como guía para el dueño.
// Se muestra solo el de las especies que tiene; si no tiene mascotas cargadas, se muestran todos.
export function GuiaVacunas({ planes, especies }: { planes: PlanSanitario[]; especies: EspecieMascota[] }) {
  const suyos = planes.filter((p) => especies.includes(p.especie))
  const visibles = suyos.length > 0 ? suyos : planes
  if (visibles.length === 0) return null

  return (
    <details className="tarjeta guia-vacunas">
      <summary>
        <CalendarHeart size={22} aria-hidden="true" />
        <span>Calendario de vacunas del primer año</span>
      </summary>
      <p className="guia-vacunas-aviso">
        Es una guía general para cachorros y gatitos. Las fechas exactas de tu mascota las indica el veterinario en la
        consulta, y la clínica te escribe por WhatsApp antes de cada una.
      </p>
      <div className="grilla-planes">
        {visibles.map((plan) => (
          <article key={plan.id} className="plan">
            {plan.fotoUrl && <img src={plan.fotoUrl} alt="" loading="lazy" className="plan-foto" />}
            <div className="plan-cuerpo">
              <h3>{plan.nombre}</h3>
              <ol className="linea-tiempo">
                {plan.dosis.map((d) => (
                  <li key={d.id}>
                    <span className="linea-tiempo-edad">{edadDosis(d.edadSemanas)}</span>
                    <span>{d.producto}</span>
                  </li>
                ))}
              </ol>
            </div>
          </article>
        ))}
      </div>
    </details>
  )
}
