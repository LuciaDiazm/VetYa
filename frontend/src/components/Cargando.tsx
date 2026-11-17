import type { CSSProperties } from 'react'

// Ícono de "cargando": ocho puntitos en ronda que se van encendiendo uno detrás del otro,
// con el texto abajo. Se usa en todas las pantallas mientras llegan los datos.
export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="cargando" role="status">
      <span className="cargando-puntos" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </span>
      <span>{texto}</span>
    </div>
  )
}
