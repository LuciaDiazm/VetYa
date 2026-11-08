import { ChevronDown, House, LogOut, PawPrint, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { rutaInicial } from '../context/AuthContext'
import type { Usuario } from '../types'

// Botón con el nombre de quien entró: muestra que la sesión está iniciada y guarda "Salir" en un menú chico.
export function MenuCuenta({ usuario, onSalir }: { usuario: Usuario; onSalir: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!abierto) return
    function tocarAfuera(e: PointerEvent) {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false)
    }
    function apretarTecla(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setAbierto(false)
      boton.current?.focus()
    }
    document.addEventListener('pointerdown', tocarAfuera)
    document.addEventListener('keydown', apretarTecla)
    return () => {
      document.removeEventListener('pointerdown', tocarAfuera)
      document.removeEventListener('keydown', apretarTecla)
    }
  }, [abierto])

  const esDuenio = usuario.rol === 'DUENIO'
  const IconoInicio = esDuenio ? PawPrint : House

  return (
    <div className="menu-cuenta" ref={raiz}>
      <button
        ref={boton}
        type="button"
        className="menu-cuenta-boton"
        aria-expanded={abierto}
        aria-controls="menu-cuenta-lista"
        onClick={() => setAbierto((a) => !a)}
      >
        <UserRound size={20} aria-hidden="true" />
        <span className="menu-cuenta-nombre">{usuario.nombre}</span>
        <ChevronDown size={18} aria-hidden="true" className={abierto ? 'menu-cuenta-flecha abierta' : 'menu-cuenta-flecha'} />
      </button>

      {abierto && (
        <div id="menu-cuenta-lista" className="menu-cuenta-lista">
          <Link to={rutaInicial(usuario)} className="menu-cuenta-opcion" onClick={() => setAbierto(false)}>
            <IconoInicio size={20} aria-hidden="true" />
            {esDuenio ? 'Mi cuenta' : 'Panel'}
          </Link>
          <div className="menu-cuenta-separador" />
          <button type="button" className="menu-cuenta-opcion" onClick={onSalir}>
            <LogOut size={20} aria-hidden="true" />
            Salir
          </button>
        </div>
      )}
    </div>
  )
}
