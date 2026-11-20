import { Servicios } from './configuracion/Servicios'

// Servicios de la clínica (solo administración): antes estaba dentro de Ajustes; ahora tiene su lugar en el menú.
export function ServiciosClinica() {
  return (
    <>
      <div className="panel-encabezado">
        <h1>Servicios</h1>
        <p>Lo que ofrece la clínica: duración, precio de referencia y si se pide por la web.</p>
      </div>
      <div className="ajustes">
        <Servicios />
      </div>
    </>
  )
}
