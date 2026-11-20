import { ArrowRight, Bell, CalendarDays, ChevronDown, HeartHandshake, KeyRound, LogOut, Search, Syringe } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiGet } from '../lib/api'
import { formatearTelefono } from '../lib/mascotas'
import { NOMBRE_ROL } from '../lib/permisos'
import type { Cliente, ResumenRecordatorios, Rol } from '../types'
import { IconoEspecie } from '../pages/panel/Clientes'

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

// Buscador de la barra de arriba: clientes y mascotas desde cualquier pantalla (el mismo buscador de
// Clientes: nombre, apellido, DNI, teléfono o nombre de la mascota). Muestra los primeros resultados;
// Enter o "Ver todos" lleva a Clientes con lo buscado.
function BuscadorPanel() {
  const navegar = useNavigate()
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto, caja] = useDesplegable()
  const [resultado, setResultado] = useState<{ q: string; clientes: Cliente[] } | null>(null)
  const q = texto.trim()

  useEffect(() => {
    if (q.length < 2) return
    let vigente = true
    const espera = window.setTimeout(() => {
      apiGet<Cliente[]>(`/clientes?q=${encodeURIComponent(q)}`)
        .then((clientes) => vigente && setResultado({ q, clientes }))
        .catch(() => vigente && setResultado({ q, clientes: [] }))
    }, 250)
    return () => {
      vigente = false
      window.clearTimeout(espera)
    }
  }, [q])

  function cerrar() {
    setAbierto(false)
    setTexto('')
    setResultado(null)
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!q) return
    navegar(`/panel/clientes?q=${encodeURIComponent(q)}`)
    cerrar()
  }

  const vigente = resultado?.q === q ? resultado.clientes : null
  const mostrar = abierto && q.length >= 2

  return (
    <div className="desplegable barra-buscador" ref={caja}>
      <form role="search" onSubmit={enviar}>
        <label>
          <Search size={20} aria-hidden="true" />
          <span className="solo-lectores">Buscar cliente o mascota</span>
          <input
            type="search"
            value={texto}
            placeholder="Buscar cliente o mascota"
            onChange={(e) => {
              setTexto(e.target.value)
              setAbierto(true)
            }}
            onFocus={() => setAbierto(true)}
          />
        </label>
      </form>
      {mostrar && (
        <div className="desplegable-panel barra-resultados">
          {vigente === null ? (
            <p className="barra-resultados-aviso">Buscando…</p>
          ) : vigente.length === 0 ? (
            <p className="barra-resultados-aviso">No encontramos a nadie con “{q}”.</p>
          ) : (
            <ul>
              {vigente.slice(0, 6).map((c) => (
                <li key={c.id} className="barra-resultado">
                  <Link to={`/panel/clientes/${c.id}`} onClick={cerrar}>
                    <span>
                      <strong>
                        {c.apellido}, {c.nombre}
                      </strong>
                      <small>{formatearTelefono(c.telefono)}</small>
                    </span>
                  </Link>
                  {c.mascotas.length > 0 && (
                    <span className="barra-resultado-mascotas">
                      {c.mascotas.map((m) => (
                        <Link key={m.id} to={`/panel/mascotas/${m.id}`} onClick={cerrar} className="chip-dato chip-mascota">
                          <IconoEspecie especie={m.especie} size={16} /> {m.nombre}
                        </Link>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link to={`/panel/clientes?q=${encodeURIComponent(q)}`} className="desplegable-pie" onClick={cerrar}>
            Ver todos en Clientes <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  )
}

// Barra de arriba del panel: el buscador, la campana con los avisos para mandar y el menú con el nombre
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
      <BuscadorPanel />
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
