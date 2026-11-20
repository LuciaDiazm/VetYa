import { ArrowRight, Bell, CalendarDays, ChevronDown, HeartHandshake, KeyRound, LogOut, Syringe } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { NOMBRE_ROL } from '../lib/permisos'
import type { ResumenRecordatorios, Rol } from '../types'

// Se cierra al tocar afuera o con Escape (como el menú "Más" de los turnos).
function useDesplegable() {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const alTocar = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('pointerdown', alTocar)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('pointerdown', alTocar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])
  return [abierto, setAbierto, caja] as const
}

// Barra de arriba del panel: la campana con los avisos para mandar y el menú con el nombre
// (cambiar contraseña y salir).
export function BarraPanel({
  avisos,
  usuario,
  alSalir,
}: {
  avisos: ResumenRecordatorios | null
  usuario: { nombre: string; apellido: string; rol: Rol }
  alSalir: () => void
}) {
  const [campanaAbierta, setCampanaAbierta, cajaCampana] = useDesplegable()
  const [cuentaAbierta, setCuentaAbierta, cajaCuenta] = useDesplegable()
  const total = avisos ? avisos.turnosManana + avisos.dosis + avisos.recuperar : 0
  const iniciales = `${usuario.nombre[0] ?? ''}${usuario.apellido[0] ?? ''}`.toUpperCase()
  const listas = [
    { id: 'manana', texto: 'Turnos de mañana', icono: CalendarDays, cantidad: avisos?.turnosManana ?? 0 },
    { id: 'vacunas', texto: 'Vacunas por vencer', icono: Syringe, cantidad: avisos?.dosis ?? 0 },
    { id: 'recuperar', texto: 'Clientes para recuperar', icono: HeartHandshake, cantidad: avisos?.recuperar ?? 0 },
  ]

  return (
    <div className="panel-barra">
      <div className="desplegable" ref={cajaCampana}>
        <button
          type="button"
          className="barra-campana"
          aria-haspopup="true"
          aria-expanded={campanaAbierta}
          aria-label={total > 0 ? `Avisos: ${total} para mandar` : 'Avisos: no hay para mandar'}
          onClick={() => {
            setCampanaAbierta((a) => !a)
            setCuentaAbierta(false)
          }}
        >
          <Bell size={22} aria-hidden="true" />
          {total > 0 && (
            <span className="barra-campana-numero" aria-hidden="true">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </button>
        {campanaAbierta && (
          <div className="desplegable-panel barra-avisos">
            <p className="desplegable-titulo">Avisos para mandar</p>
            <ul>
              {listas.map(({ id, texto, icono: Icono, cantidad }) => (
                <li key={id}>
                  <Link to={`/panel/recordatorios#${id}`} onClick={() => setCampanaAbierta(false)}>
                    <Icono size={18} aria-hidden="true" />
                    <span>{texto}</span>
                    <span className={`barra-avisos-numero${cantidad === 0 ? ' en-cero' : ''}`}>{cantidad}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/panel/recordatorios" className="desplegable-pie" onClick={() => setCampanaAbierta(false)}>
              Ver todos los avisos <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>

      <div className="desplegable" ref={cajaCuenta}>
        <button
          type="button"
          className="barra-cuenta"
          aria-haspopup="true"
          aria-expanded={cuentaAbierta}
          onClick={() => {
            setCuentaAbierta((a) => !a)
            setCampanaAbierta(false)
          }}
        >
          <span className="barra-iniciales" aria-hidden="true">
            {iniciales}
          </span>
          <span className="barra-nombre">{usuario.nombre}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {cuentaAbierta && (
          <div className="desplegable-panel barra-menu-cuenta">
            <p className="desplegable-titulo">
              {usuario.nombre} {usuario.apellido}
              <span>{NOMBRE_ROL[usuario.rol]}</span>
            </p>
            <ul>
              <li>
                <Link to="/panel/contrasena" onClick={() => setCuentaAbierta(false)}>
                  <KeyRound size={18} aria-hidden="true" />
                  <span>Cambiar contraseña</span>
                </Link>
              </li>
              <li>
                <button type="button" className="barra-salir" onClick={alSalir}>
                  <LogOut size={18} aria-hidden="true" />
                  <span>Salir</span>
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
