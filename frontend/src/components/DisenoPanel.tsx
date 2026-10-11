import { BellRing, CalendarDays, House, LogOut, PawPrint, Settings } from 'lucide-react'
import { startTransition } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from './Logo'

// Estructura del panel interno: menú lateral (arriba en el celular) y contenido.
export function DisenoPanel() {
  const { usuario, salir } = useAuth()
  const navegar = useNavigate()

  function cerrarSesion() {
    // Ver el comentario en BarraNavegacion: navegar y salir en la misma transición.
    startTransition(() => {
      navegar('/')
      salir()
    })
  }

  const secciones = [
    { ruta: '/panel', nombre: 'Hoy', icono: House, fin: true },
    { ruta: '/panel/agenda', nombre: 'Agenda', icono: CalendarDays },
    { ruta: '/panel/clientes', nombre: 'Clientes y mascotas', icono: PawPrint },
    { ruta: '/panel/recordatorios', nombre: 'Recordatorios', icono: BellRing },
    ...(usuario?.rol === 'ADMIN'
      ? [{ ruta: '/panel/configuracion', nombre: 'Configuración', icono: Settings }]
      : []),
  ]

  return (
    <div className="panel">
      <aside className="panel-menu">
        <NavLink to="/" className="enlace-logo" aria-label="Ir a la página pública">
          <Logo />
        </NavLink>
        <nav className="panel-navegacion" aria-label="Secciones del panel">
          {secciones.map(({ ruta, nombre, icono: Icono, fin }) => (
            <NavLink key={ruta} to={ruta} end={fin} className="panel-enlace">
              <Icono size={20} aria-hidden="true" />
              {nombre}
            </NavLink>
          ))}
        </nav>
        <div className="panel-usuario">
          <strong>
            {usuario?.nombre} {usuario?.apellido}
          </strong>
          <span>{usuario?.rol === 'ADMIN' ? 'Administración' : 'Veterinaria/o'}</span>
          <button type="button" className="boton-texto" onClick={cerrarSesion}>
            <LogOut size={18} aria-hidden="true" />
            Salir
          </button>
        </div>
      </aside>
      <main className="panel-contenido">
        <Outlet />
      </main>
    </div>
  )
}
