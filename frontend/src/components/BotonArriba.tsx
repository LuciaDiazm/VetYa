import { ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'

// Botón flotante para volver al principio de la página. Aparece recién después de bajar una pantalla.
export function BotonArriba() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function revisar() {
      setVisible(window.scrollY > window.innerHeight * 0.8)
    }
    revisar()
    window.addEventListener('scroll', revisar, { passive: true })
    return () => window.removeEventListener('scroll', revisar)
  }, [])

  function subir() {
    window.scrollTo({ top: 0 }) // el desplazamiento suave ya lo define el CSS (y respeta "reducir movimiento")
    // El botón desaparece al llegar arriba: el foco del teclado pasa al logo para no perderse.
    document.querySelector<HTMLElement>('.enlace-logo')?.focus({ preventScroll: true })
  }

  return (
    <button type="button" className={`boton-arriba${visible ? ' visible' : ''}`} onClick={subir}>
      <ArrowUp size={20} aria-hidden="true" />
      Arriba
    </button>
  )
}
