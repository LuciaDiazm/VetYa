import type { MouseEvent } from 'react'

// Primer enlace de la página: solo se ve al usar el teclado (Tab). Lleva directo al contenido,
// sin pasar por todo el menú. No cambia la dirección de la página.
export function SaltarAlContenido() {
  function saltar(evento: MouseEvent<HTMLAnchorElement>) {
    const contenido = document.querySelector('main')
    if (!contenido) return
    evento.preventDefault()
    contenido.setAttribute('tabindex', '-1')
    contenido.focus()
    contenido.scrollIntoView()
  }

  return (
    <a href="#contenido" className="saltar-contenido" onClick={saltar}>
      Saltar al contenido
    </a>
  )
}
