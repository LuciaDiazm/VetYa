import { useAuth } from '../context/AuthContext'

// Cuenta del dueño de mascota. Por ahora es una página de bienvenida:
// sus mascotas, turnos y carnet se agregan en los próximos módulos.
export function MiCuenta() {
  const { usuario } = useAuth()

  return (
    <main className="contenedor">
      <h1>Hola, {usuario?.nombre}</h1>
      <p className="ayuda">Acá vas a ver tus mascotas, su historia clínica y tus turnos.</p>
    </main>
  )
}
