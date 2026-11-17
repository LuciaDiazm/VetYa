import { LogOut, Menu, UserRound, X } from 'lucide-react'
import { startTransition, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { rutaInicial, useAuth } from '../context/AuthContext'
import { IconoSirena } from './IconoSirena'
import { Logo } from './Logo'
import { MenuCuenta } from './MenuCuenta'

const SECCIONES = [
  { ruta: '/#servicios', nombre: 'Servicios' },
  { ruta: '/#equipo', nombre: 'Equipo', soloMenu: true },
  { ruta: '/#preguntas', nombre: 'Preguntas', soloMenu: true },
  { ruta: '/#contacto', nombre: 'Horarios y dirección' },
]

// Dentro de Mi cuenta el menú lleva a las partes de la cuenta, no a las del inicio.
const SECCIONES_CUENTA = [
  { ruta: '/mi-cuenta#turnos', nombre: 'Mis turnos' },
  { ruta: '/mi-cuenta#vacunas', nombre: 'Vacunas y carnet' },
  { ruta: '/mi-cuenta#visitas', nombre: 'Visitas' },
]

// Encabezado de la parte pública. Pocas opciones y bien grandes:
// lo más buscado (pedir turno y urgencias) siempre queda a la vista.
export function BarraNavegacion() {
  const { usuario, cargando, salir } = useAuth()
  const navegar = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  // En Ingresar el encabezado queda despejado: solo el logo y el menú redondo de tres rayitas.
  const { pathname } = useLocation()
  const soloMenu = pathname === '/ingresar'
  // En Mi cuenta el único "Pedir turno" es el azul del saludo: el del encabezado se oculta.
  const enCuenta = pathname === '/mi-cuenta'
  // Con la sesión de un dueño iniciada, el menú de la cuenta se mantiene en todas las páginas
  // (Urgencias, Pedir turno, Cirugías…) salvo en el inicio, que muestra las secciones del sitio.
  const menuDeCuenta = usuario?.rol === 'DUENIO' && pathname !== '/'
  const secciones: { ruta: string; nombre: string; soloMenu?: boolean }[] = menuDeCuenta ? SECCIONES_CUENTA : SECCIONES

  function cerrarSesion() {
    // React Router navega dentro de una transición. Si la sesión se borrara por fuera de ella,
    // la página protegida se volvería a mostrar sin usuario y redirigiría al login.
    startTransition(() => {
      navegar('/')
      salir()
    })
    setMenuAbierto(false)
  }

  const cerrarMenu = () => setMenuAbierto(false)

  const cuentaMovil = cargando ? null : usuario ? (
    <div className="menu-movil-cuenta">
      <p className="menu-movil-usuario">
        <UserRound size={20} aria-hidden="true" />
        Hola, {usuario.nombre}
      </p>
      <Link to={rutaInicial(usuario)} className="barra-enlace" onClick={cerrarMenu}>
        {usuario.rol === 'DUENIO' ? 'Mi cuenta' : 'Panel'}
      </Link>
      <button type="button" className="barra-enlace boton-texto menu-movil-salir" onClick={cerrarSesion}>
        <LogOut size={20} aria-hidden="true" />
        Salir
      </button>
    </div>
  ) : (
    <div className="menu-movil-cuenta">
      <Link to="/ingresar" className="barra-enlace" onClick={cerrarMenu}>
        Ingresar
      </Link>
    </div>
  )

  return (
    <header className={`encabezado${soloMenu ? ' encabezado-solo-menu' : ''}${enCuenta ? ' encabezado-cuenta' : ''}`}>
      <div className="contenedor barra-interior">
        <Link to="/" className="enlace-logo" aria-label="VetYa, ir al inicio" onClick={cerrarMenu}>
          <Logo />
        </Link>

        <nav className="menu-principal" aria-label="Secciones del sitio">
          {secciones.filter((s) => !s.soloMenu).map((s) => (
            <Link key={s.ruta} to={s.ruta} className="barra-enlace">
              {s.nombre}
            </Link>
          ))}
          <Link to="/urgencias" className="barra-enlace enlace-urgencias">
            <IconoSirena size={20} aria-hidden="true" className="icono-sirena" />
            Urgencias
          </Link>
        </nav>

        <div className="barra-acciones">
          {/* Va primero: cuando se oculta en la portada, el hueco queda junto al menú y nada se corre. */}
          <Link to="/turno" className="boton boton-amarillo-claro boton-brillo boton-turno">
            Pedir turno
          </Link>
          {/* En pantallas chicas el menú de vidrio se oculta: Urgencias queda siempre a la vista acá */}
          <Link to="/urgencias" className="enlace-urgencias urgencias-chica">
            <IconoSirena size={20} aria-hidden="true" className="icono-sirena" />
            <span>Urgencias</span>
          </Link>
          {!cargando && (
            <div className="cuenta-compu">
              {usuario ? (
                <MenuCuenta usuario={usuario} onSalir={cerrarSesion} />
              ) : (
                <Link to="/ingresar" className="barra-enlace enlace-ingresar">
                  <UserRound size={20} aria-hidden="true" />
                  Ingresar
                </Link>
              )}
            </div>
          )}
          <button
            type="button"
            className="boton-menu"
            aria-expanded={menuAbierto}
            aria-controls="menu-movil"
            onClick={() => setMenuAbierto((a) => !a)}
          >
            {menuAbierto ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
            <span>{menuAbierto ? 'Cerrar' : 'Menú'}</span>
          </button>
        </div>
      </div>

      {menuAbierto && (
        <nav id="menu-movil" className="menu-movil" aria-label="Menú">
          {secciones.map((s) => (
            <Link key={s.ruta} to={s.ruta} className="barra-enlace" onClick={cerrarMenu}>
              {s.nombre}
            </Link>
          ))}
          <Link to="/turno" className="barra-enlace" onClick={cerrarMenu}>
            Pedir turno
          </Link>
          <Link to="/urgencias" className="barra-enlace" onClick={cerrarMenu}>
            Urgencias
          </Link>
          {cuentaMovil}
        </nav>
      )}
    </header>
  )
}
