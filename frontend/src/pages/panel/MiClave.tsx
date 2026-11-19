import { CambiarClave } from '../../components/CambiarClave'

// Cada persona del personal cambia su propia contraseña, sin pedírsela al administrador.
export function MiClave() {
  return (
    <>
      <div className="panel-encabezado">
        <h1>Mi contraseña</h1>
        <p>Cambiala cuando quieras. Si te la olvidaste, pedile a la administración que te dé una nueva.</p>
      </div>
      <section className="tarjeta formulario mi-clave">
        <CambiarClave />
      </section>
    </>
  )
}
