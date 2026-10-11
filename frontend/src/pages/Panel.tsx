import { useAuth } from '../context/AuthContext'

// Panel del personal (veterinario y administrador). Por ahora es una página de bienvenida:
// la agenda, los recordatorios y la historia clínica se agregan en los próximos módulos.
export function Panel() {
  const { usuario } = useAuth()

  return (
    <main className="contenedor">
      <h1>Hola, {usuario?.nombre}</h1>
      <p>Rol: {usuario?.rol === 'ADMIN' ? 'Administrador' : 'Veterinario'}</p>
      <p className="ayuda">Acá van a aparecer la agenda del día, los recordatorios y los clientes para recuperar.</p>
    </main>
  )
}
