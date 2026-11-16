import { BellRing, CalendarDays, CalendarPlus, HeartPulse, Syringe } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../lib/api'
import { diaLargo, hoyArgentina } from '../lib/fechas'
import type { ResumenRecordatorios, Turno } from '../types'
import { AvisosSuspension } from '../components/AvisosSuspension'
import { TarjetaTurno } from '../components/TarjetaTurno'

// Inicio del panel: lo que hay que hacer hoy.
export function Panel() {
  const { usuario } = useAuth()
  const [hoy] = useState(hoyArgentina)
  const [turnos, setTurnos] = useState<Turno[] | null>(null)
  const [resumen, setResumen] = useState<ResumenRecordatorios | null>(null)

  useEffect(() => {
    apiGet<Turno[]>(`/turnos?desde=${hoy}`)
      .then(setTurnos)
      .catch(() => setTurnos([]))
    apiGet<ResumenRecordatorios>('/recordatorios/resumen').then(setResumen).catch(() => {})
  }, [hoy])

  const activos = (turnos ?? []).filter((t) => t.estado !== 'CANCELADO')
  const porAtender = activos.filter((t) => t.estado === 'PENDIENTE' || t.estado === 'CONFIRMADO')

  return (
    <>
      <div className="panel-encabezado panel-encabezado-acciones">
        <div>
          <h1>Hola, {usuario?.nombre}</h1>
          <p>Hoy es {diaLargo(hoy)}.</p>
        </div>
        <Link to="/panel/agenda/nuevo" className="boton boton-grande boton-secundario">
          <CalendarPlus size={22} aria-hidden="true" /> Dar turno
        </Link>
      </div>

      <AvisosSuspension />

      <section className="tarjeta bloque-ficha">
        <div className="bloque-ficha-titulo">
          <h2>
            <CalendarDays size={22} aria-hidden="true" /> Turnos de hoy
          </h2>
          {turnos && activos.length > 0 && (
            <span className="ayuda">
              {porAtender.length === 0
                ? 'Ya atendiste todos'
                : porAtender.length === 1
                  ? 'Falta atender 1'
                  : `Faltan atender ${porAtender.length}`}
            </span>
          )}
        </div>
        {turnos === null ? (
          <p className="cargando">Cargando…</p>
        ) : activos.length === 0 ? (
          <p className="vacio">No hay turnos para hoy.</p>
        ) : (
          <ul className="lista-turnos">
            {activos.map((t) => (
              <TarjetaTurno
                key={t.id}
                turno={t}
                alCambiar={(nuevo) => setTurnos((l) => l?.map((x) => (x.id === nuevo.id ? nuevo : x)) ?? null)}
              />
            ))}
          </ul>
        )}
        <Link to="/panel/agenda" className="boton-texto enlace-chico">
          Ver la agenda de la semana
        </Link>
      </section>

      {resumen && (
        <div className="grilla-resumen">
          {[
            { cantidad: resumen.turnosManana, icono: BellRing, singular: 'turno de mañana para recordar', plural: 'turnos de mañana para recordar' },
            { cantidad: resumen.dosis, icono: Syringe, singular: 'vacuna o desparasitación por vencer', plural: 'vacunas y desparasitaciones por vencer' },
            { cantidad: resumen.recuperar, icono: HeartPulse, singular: 'cliente para recuperar', plural: 'clientes para recuperar' },
          ].map(({ cantidad, icono: Icono, singular, plural }) => (
            <Link key={plural} to="/panel/recordatorios" className="tarjeta resumen-numero">
              <span className="icono-circulo">
                <Icono size={22} aria-hidden="true" />
              </span>
              <span>
                <strong>{cantidad}</strong> {cantidad === 1 ? singular : plural}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
