import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  pagina: number
  total: number
  porPagina: number
  // Qué se cuenta, en plural ("clientes", "turnos").
  queSeCuenta: string
  alCambiar: (pagina: number) => void
}

// Paginación simple: "Anterior" y "Siguiente" bien grandes, con la página actual escrita en el medio.
// Si todo entra en una sola página, no se muestra.
export function Paginacion({ pagina, total, porPagina, queSeCuenta, alCambiar }: Props) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  if (paginas <= 1) return null
  const desde = (pagina - 1) * porPagina + 1
  const hasta = Math.min(pagina * porPagina, total)

  return (
    <nav className="paginacion no-imprimir" aria-label="Páginas">
      <button
        type="button"
        className="boton boton-contorno"
        disabled={pagina <= 1}
        onClick={() => alCambiar(pagina - 1)}
      >
        <ChevronLeft size={20} aria-hidden="true" /> Anterior
      </button>
      <p className="paginacion-texto" aria-live="polite">
        <strong>
          Página {pagina} de {paginas}
        </strong>
        <span>
          {desde} a {hasta} de {total} {queSeCuenta}
        </span>
      </p>
      <button
        type="button"
        className="boton boton-contorno"
        disabled={pagina >= paginas}
        onClick={() => alCambiar(pagina + 1)}
      >
        Siguiente <ChevronRight size={20} aria-hidden="true" />
      </button>
    </nav>
  )
}
