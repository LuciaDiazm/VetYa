import { BellRing, CalendarDays, Syringe } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const FECHA = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

// Inicio del panel: resumen del día. Cada bloque se completa cuando se construya su módulo.
export function Panel() {
  const { usuario } = useAuth()
  // Se calcula una sola vez al abrir la página.
  const [hoy] = useState(() => FECHA.format(new Date()))

  return (
    <>
      <div className="panel-encabezado">
        <h1>Hola, {usuario?.nombre}</h1>
        <p>Hoy es {hoy}.</p>
      </div>

      <div className="grilla-resumen">
        <section className="tarjeta">
          <div className="resumen-titulo">
            <span className="icono-circulo">
              <CalendarDays size={22} aria-hidden="true" />
            </span>
            <h2>Turnos de hoy</h2>
          </div>
          <p className="vacio">Cuando esté lista la agenda, acá vas a ver los turnos del día en orden.</p>
        </section>

        <section className="tarjeta">
          <div className="resumen-titulo">
            <span className="icono-circulo">
              <Syringe size={22} aria-hidden="true" />
            </span>
            <h2>Vacunas por vencer</h2>
          </div>
          <p className="vacio">Las mascotas que necesitan un refuerzo esta semana van a aparecer acá.</p>
        </section>

        <section className="tarjeta">
          <div className="resumen-titulo">
            <span className="icono-circulo">
              <BellRing size={22} aria-hidden="true" />
            </span>
            <h2>Avisos para enviar</h2>
          </div>
          <p className="vacio">Los recordatorios de WhatsApp pendientes, listos para mandar con un clic.</p>
        </section>
      </div>
    </>
  )
}
