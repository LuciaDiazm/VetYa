// Para los movimientos de la página de presentación: cuando el elemento aparece en pantalla
// le agrega la clase "visible" (una sola vez) y el CSS hace la animación.
// Se usa como ref de React: <div ref={revelarAlBajar}>. Devuelve la limpieza (React 19).
export function revelarAlBajar(elemento: HTMLElement | null) {
  if (!elemento) return
  if (!('IntersectionObserver' in window)) {
    elemento.classList.add('visible')
    return
  }
  const observador = new IntersectionObserver(
    ([entrada]) => {
      if (entrada.isIntersecting) {
        elemento.classList.add('visible')
        observador.disconnect()
      }
    },
    { threshold: 0.2 },
  )
  observador.observe(elemento)
  return () => observador.disconnect()
}
