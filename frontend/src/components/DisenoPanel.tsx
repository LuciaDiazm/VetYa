import { BarChart3, Bell, CalendarDays, FileText, House, LogOut, PawPrint, Settings } from 'lucide-react'
import { startTransition, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { apiGet } from '../lib/api'
import type { ResumenRecordatorios } from '../types'
import { useAuth } from '../context/AuthContext'
import { Logo } from './Logo'

// Estructura del panel interno: barra azul angosta con íconos (el nombre aparece al pasar el mouse
// o al llegar con el teclado; en el celular va arriba y con el nombre siempre escrito) y el contenido.
export function DisenoPanel() {
  const { usuario, salir } = useAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const avisosPendientes = useAvisosPendientes(ubicacion.pathname)

  function cerrarSesion() {
    // Ver el comentario en BarraNavegacion: navegar y salir en la misma transición.
    startTransition(() => {
      navegar('/')
      salir()
    })
  }

  const secciones: { ruta: string; nombre: string; icono: typeof House; fin?: boolean; globo?: number }[] = [
    { ruta: '/panel', nombre: 'Hoy', icono: House, fin: true },
    { ruta: '/panel/agenda', nombre: 'Agenda', icono: CalendarDays },
    { ruta: '/panel/clientes', nombre: 'Clientes y mascotas', icono: PawPrint },
    { ruta: '/panel/recordatorios', nombre: 'Notificaciones', icono: Bell, globo: avisosPendientes },
    { ruta: '/panel/estadisticas', nombre: 'Estadísticas', icono: BarChart3 },
    { ruta: '/panel/informe', nombre: 'Informe de turnos', icono: FileText },
    ...(usuario?.rol === 'ADMIN'
      ? [{ ruta: '/panel/configuracion', nombre: 'Configuración', icono: Settings }]
      : []),
  ]

  return (
    <div className="panel">
      <aside className="panel-menu">
        <NavLink to="/" className="enlace-logo" aria-label="VetYa, ir a la página pública">
          <Logo />
        </NavLink>
        <nav className="panel-navegacion" aria-label="Secciones del panel">
          {secciones.map(({ ruta, nombre, icono: Icono, fin, globo }) => (
            <NavLink key={ruta} to={ruta} end={fin} className="panel-enlace">
              <Icono size={24} aria-hidden="true" />
              <span className="panel-enlace-nombre">{nombre}</span>
              {!!globo && (
                <span className="globo" aria-label={`${globo} nuevas`}>
                  {globo}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <span className="panel-inicial" title={`${usuario?.nombre ?? ''} ${usuario?.apellido ?? ''}`}>
          <span aria-hidden="true">{usuario?.nombre?.[0]?.toUpperCase()}</span>
          <span className="solo-lectores">
            Sesión de {usuario?.nombre} {usuario?.apellido}
          </span>
        </span>
        <button type="button" className="panel-enlace panel-salir" onClick={cerrarSesion}>
          <LogOut size={24} aria-hidden="true" />
          <span className="panel-salir-texto">Salir</span>
        </button>
      </aside>
      <main className="panel-contenido">
        <Outlet />
      </main>
    </div>
  )
}

// Todos los avisos pendientes: el mismo número que suman las tres tarjetas de Notificaciones.
function useAvisosPendientes(ruta: string) {
  const [cantidad, setCantidad] = useState(0)
  useEffect(() => {
    const consultar = () =>
      apiGet<ResumenRecordatorios>('/recordatorios/resumen')
        .then((r) => setCantidad(r.turnosManana + r.dosis + r.recuperar))
        .catch(() => {})
    consultar()
    window.addEventListener('recordatorios-actualizados', consultar)
    return () => window.removeEventListener('recordatorios-actualizados', consultar)
  }, [ruta])
  return cantidad
}
