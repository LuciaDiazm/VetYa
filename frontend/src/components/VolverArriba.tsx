import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Al pasar a otra página, se empieza a verla desde arriba (como en cualquier sitio).
// No actúa con un enlace a una parte de la página ("/#servicios"), que baja solo hasta ahí,
// ni con "Atrás" / "Adelante" del navegador, que vuelven adonde estaba la persona.
export function VolverArriba() {
  const { pathname, hash } = useLocation()
  const tipo = useNavigationType()

  useLayoutEffect(() => {
    if (hash || tipo === 'POP') return
    // "instant": sin el desplazamiento suave del CSS, para que no se vea la página subir
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, hash, tipo])

  return null
}
