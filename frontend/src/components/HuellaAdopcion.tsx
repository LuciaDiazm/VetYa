import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fotoPrincipal } from '../lib/adopcion'
import type { AnimalAdopcion } from '../types'

const DEDOS = 4
const INTERVALO_MS = 4000

// Huella gigante: en los cuatro "deditos" van fotos de animales en adopción que rotan cada pocos segundos,
// y en la almohadilla central va el contenido (título y botón). Tocar un dedito abre la ficha del animal.
export function HuellaAdopcion({ animales, children }: { animales: AnimalAdopcion[]; children: ReactNode }) {
  const [desplazamiento, setDesplazamiento] = useState(0)
  const rota = animales.length > DEDOS

  useEffect(() => {
    if (!rota || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const intervalo = window.setInterval(() => setDesplazamiento((d) => d + 1), INTERVALO_MS)
    return () => window.clearInterval(intervalo)
  }, [rota])

  const visibles = Array.from({ length: Math.min(DEDOS, animales.length) }, (_, i) => {
    return animales[(i + desplazamiento) % animales.length]
  })

  return (
    <div className="huella">
      <div className="huella-dedos">
        {visibles.map((animal, i) => (
          <Link
            // La clave cambia con el animal: así se reproduce la animación de entrada en cada cambio.
            key={`${i}-${animal.id}`}
            to={`/adopcion/${animal.id}`}
            className={`huella-dedo huella-dedo-${i + 1}`}
            aria-label={`Conocer a ${animal.nombre}`}
          >
            <img src={fotoPrincipal(animal)} alt="" />
            <span>{animal.nombre}</span>
          </Link>
        ))}
      </div>
      <div className="huella-almohadilla">{children}</div>
    </div>
  )
}
