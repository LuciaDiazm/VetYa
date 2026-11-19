import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { hayPantallaAnterior } from '../lib/navegacion'

// "← Volver" de las pantallas del panel: vuelve a la pantalla de la que se vino (Hoy, Agenda, la ficha…).
// Si se entró directo por el enlace (no hay pantalla anterior dentro del sistema), va a "siNoHay".
export function BotonVolver({ siNoHay }: { siNoHay: string }) {
  const navegar = useNavigate()
  return (
    <button
      type="button"
      className="volver"
      onClick={() => (hayPantallaAnterior() ? navegar(-1) : navegar(siNoHay, { replace: true }))}
    >
      <ArrowLeft size={20} aria-hidden="true" /> Volver
    </button>
  )
}
