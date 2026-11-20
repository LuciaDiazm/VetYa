import { BarChart3, CalendarDays, FileText, HandCoins, House, PawPrint, Settings } from 'lucide-react'
import { startTransition, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { apiGet } from '../lib/api'
import { puede } from '../lib/permisos'
import type { ResumenRecordatorios } from '../types'
import { useAuth } from '../context/AuthContext'
import { BarraPanel } from './BarraPanel'
import { Logo } from './Logo'

// Estructura del panel interno: barra azul a la izquierda con cada sección (ícono y nombre escrito;
// en el celular va arriba, con el nombre debajo del ícono), la barra de arriba (campana de avisos y
// menú con el nombre: contraseña y salir) y el contenido.
export function DisenoPanel() {
  const { usuario, salir } = useAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const avisos = useAvisosPendientes(ubicacion.pathname)

  function cerrarSesion() {
    // Ver el comentario en BarraNavegacion: navegar y salir en la misma transición.
    startTransition(() => {
      navegar('/')
      salir()
    })
  }

  const secciones: { ruta: string; nombre: string; icono: typeof House; fin?: boolean }[] = [
    { ruta: '/panel', nombre: 'Hoy', icono: House, fin: true },
    { ruta: '/panel/agenda', nombre: 'Agenda', icono: CalendarDays },
    { ruta: '/panel/clientes', nombre: 'Clientes', icono: PawPrint },
    { ruta: '/panel/pagos', nombre: 'Pagos', icono: HandCoins },
    // Lo de la administración (números del negocio y ajustes) solo lo ve la administración.
    ...(puede(usuario, 'estadisticas')
      ? [
          { ruta: '/panel/estadisticas', nombre: 'Estadísticas', icono: BarChart3 },
          { ruta: '/panel/informe', nombre: 'Informe', icono: FileText },
        ]
      : []),
    ...(puede(usuario, 'ajustes') ? [{ ruta: '/panel/configuracion', nombre: 'Ajustes', icono: Settings }] : []),
  ]

  return (
    <div className="panel">
      <aside className="panel-menu">
        <NavLink to="/" className="enlace-logo" aria-label="VetYa, ir a la página pública">
          <Logo />
        </NavLink>
        <nav className="panel-navegacion" aria-label="Secciones del panel">
          {secciones.map(({ ruta, nombre, icono: Icono, fin }) => (
            <NavLink key={ruta} to={ruta} end={fin} className="panel-enlace">
              <Icono size={24} aria-hidden="true" />
              <span className="panel-enlace-nombre">{nombre}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="panel-columna">
        {usuario && <BarraPanel avisos={avisos} usuario={usuario} alSalir={cerrarSesion} />}
        <main className="panel-contenido">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// Todos los avisos pendientes: el mismo número que suman las tres tarjetas de Notificaciones.
function useAvisosPendientes(ruta: string) {
  const [cantidad, setCantidad] = useState<ResumenRecordatorios | null>(null)
  useEffect(() => {
    const consultar = () =>
      apiGet<ResumenRecordatorios>('/recordatorios/resumen')
        .then(setCantidad)
        .catch(() => {})
    consultar()
    window.addEventListener('recordatorios-actualizados', consultar)
    return () => window.removeEventListener('recordatorios-actualizados', consultar)
  }, [ruta])
  return cantidad
}
