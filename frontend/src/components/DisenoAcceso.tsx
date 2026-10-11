import type { ReactNode } from 'react'
import { IlustracionMascotas } from './Ilustracion'

// Estructura compartida por las pantallas de ingreso y registro:
// ilustración a la izquierda (arriba en el celular) y formulario a la derecha.
export function DisenoAcceso({ frase, children }: { frase: string; children: ReactNode }) {
  return (
    <main className="acceso">
      <div className="acceso-ilustracion">
        <IlustracionMascotas />
        <p>{frase}</p>
      </div>
      <div className="acceso-formulario">{children}</div>
    </main>
  )
}
