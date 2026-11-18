// Dos campos grandes, "Desde" y "Hasta", para elegir cualquier período (ambas fechas inclusive).
export function ElegirFechas({
  desde,
  hasta,
  alCambiar,
  compacto,
}: {
  desde: string
  hasta: string
  alCambiar: (desde: string, hasta: string) => void
  // Compacto: "Desde" va adentro del recuadro, en la misma línea (barra de filtros del informe).
  compacto?: boolean
}) {
  if (compacto) {
    return (
      <>
        <label className="campo-compacto">
          <span>Desde</span>
          <input type="date" value={desde} max={hasta} onChange={(e) => e.target.value && alCambiar(e.target.value, hasta)} />
        </label>
        <label className="campo-compacto">
          <span>Hasta</span>
          <input type="date" value={hasta} min={desde} onChange={(e) => e.target.value && alCambiar(desde, e.target.value)} />
        </label>
      </>
    )
  }
  return (
    <div className="elegir-fechas">
      <label className="campo">
        Desde
        <input type="date" value={desde} max={hasta} onChange={(e) => e.target.value && alCambiar(e.target.value, hasta)} />
      </label>
      <label className="campo">
        Hasta
        <input type="date" value={hasta} min={desde} onChange={(e) => e.target.value && alCambiar(desde, e.target.value)} />
      </label>
    </div>
  )
}
