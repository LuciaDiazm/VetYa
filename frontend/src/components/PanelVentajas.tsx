import { Check } from 'lucide-react'

interface Props {
  lema: string
  ventajas: { titulo: string; detalle: string }[]
}

// Mitad azul de Ingresar y Crear cuenta: una frase grande y lo que el dueño encuentra con su cuenta.
export function PanelVentajas({ lema, ventajas }: Props) {
  return (
    <section className="registro-ventajas" aria-label="Para qué sirve la cuenta">
      <p className="registro-lema">{lema}</p>
      <ul>
        {ventajas.map((v) => (
          <li key={v.titulo}>
            <span className="registro-tilde" aria-hidden="true">
              <Check size={22} strokeWidth={2.6} />
            </span>
            <span>
              <strong>{v.titulo}</strong>
              {v.detalle}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
