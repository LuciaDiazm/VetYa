import type { ReactNode } from 'react'

interface Props {
  foto: string
  frase: string
  children: ReactNode
}

// Estructura compartida por las pantallas de ingreso y registro:
// foto de una mascota a la izquierda (arriba en el celular) y formulario a la derecha.
export function DisenoAcceso({ foto, frase, children }: Props) {
  return (
    <main className="acceso">
      <div className="acceso-foto">
        <img src={foto} alt="" />
        <p>{frase}</p>
      </div>
      <div className="acceso-formulario">{children}</div>
    </main>
  )
}
