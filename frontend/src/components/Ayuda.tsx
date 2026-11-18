import { useEffect, useId, useRef, useState } from 'react'

// Botoncito redondo "?" que abre una explicación corta. Se cierra tocando afuera o con Escape.
export function Ayuda({ texto, etiqueta = 'Qué es esto' }: { texto: string; etiqueta?: string }) {
  const [abierta, setAbierta] = useState(false)
  const caja = useRef<HTMLSpanElement>(null)
  const id = useId()

  useEffect(() => {
    if (!abierta) return
    const alTocar = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierta(false)
    }
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setAbierta(false)
    document.addEventListener('pointerdown', alTocar)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('pointerdown', alTocar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierta])

  return (
    <span className="ayuda-globo" ref={caja}>
      <button
        type="button"
        className="ayuda-boton"
        aria-label={etiqueta}
        aria-expanded={abierta}
        aria-controls={id}
        onClick={() => setAbierta((a) => !a)}
      >
        ?
      </button>
      {abierta && (
        <span id={id} role="note" className="ayuda-texto">
          {texto}
        </span>
      )}
    </span>
  )
}
