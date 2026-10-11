import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { rutaInicial, useAuth } from '../context/AuthContext'
import type { Rol } from '../types'

// Solo deja ver la página a usuarios con sesión iniciada y con alguno de los roles indicados.
export function RutaProtegida({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { usuario, cargando } = useAuth()
  const ubicacion = useLocation()

  if (cargando) return <main className="contenedor"><p>Cargando…</p></main>

  if (!usuario) return <Navigate to="/ingresar" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />

  // Tiene sesión pero no el rol: lo mandamos a su propia página.
  if (!roles.includes(usuario.rol)) return <Navigate to={rutaInicial(usuario)} replace />

  return children
}
