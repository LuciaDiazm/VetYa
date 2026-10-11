import { IlustracionMascotas } from '../components/Ilustracion'
import { useAuth } from '../context/AuthContext'

// Cuenta del dueño de mascota. Sus mascotas, turnos y carnet se agregan en los próximos módulos.
export function MiCuenta() {
  const { usuario } = useAuth()

  return (
    <main className="contenedor mi-cuenta">
      <section className="bienvenida">
        <IlustracionMascotas />
        <div>
          <h1>Hola, {usuario?.nombre}</h1>
          <p>Acá vas a ver a tus mascotas, su historia clínica, sus vacunas y tus próximos turnos.</p>
        </div>
      </section>
    </main>
  )
}
