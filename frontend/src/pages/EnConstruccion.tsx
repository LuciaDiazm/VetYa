// Página temporal para las secciones del panel que todavía no se construyeron.
export function EnConstruccion({ titulo }: { titulo: string }) {
  return (
    <>
      <div className="panel-encabezado">
        <h1>{titulo}</h1>
      </div>
      <div className="tarjeta">
        <p className="vacio">Esta sección se suma en los próximos módulos del proyecto.</p>
      </div>
    </>
  )
}
