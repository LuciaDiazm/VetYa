import { CalendarDays, CalendarPlus, FileDown, MessageCircle, Stethoscope, Syringe } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IlustracionMascotas } from '../components/Ilustracion'
import { useAuth } from '../context/AuthContext'
import { apiGet, apiPatch, ErrorApi } from '../lib/api'
import { diaDe, diaLargo, fechaCortaDe, horaDe, hoyArgentina } from '../lib/fechas'
import { edadTexto, ESPECIES, FECHA_CORTA } from '../lib/mascotas'
import { estadoDosis, ultimasPorProducto } from '../lib/sanitario'
import { enlaceWhatsapp, useSitio } from '../lib/sitio'
import type { DatosMiCuenta, MascotaDelDueno } from '../types'
import { IconoEspecie } from './panel/Clientes'

const CONSULTAS_A_LA_VISTA = 3

function TarjetaMascota({
  mascota,
  horasCancelacion,
  whatsappClinica,
  alCancelar,
}: {
  mascota: MascotaDelDueno
  horasCancelacion: number
  whatsappClinica: string | null
  alCancelar: (turnoId: number) => void
}) {
  const [hoy] = useState(hoyArgentina)
  const [ahora] = useState(() => Date.now())
  const [todasLasConsultas, setTodasLasConsultas] = useState(false)
  const dosis = ultimasPorProducto(mascota.aplicaciones)
  const consultas = todasLasConsultas ? mascota.consultas : mascota.consultas.slice(0, CONSULTAS_A_LA_VISTA)
  const edad = edadTexto(mascota.fechaNacimiento)

  return (
    <article className="tarjeta mascota-dueno">
      <header className="mascota-dueno-encabezado">
        <span className="icono-circulo">
          <IconoEspecie especie={mascota.especie} size={26} />
        </span>
        <div>
          <h2>{mascota.nombre}</h2>
          <p>
            {ESPECIES[mascota.especie]}
            {mascota.raza && `, ${mascota.raza}`}
            {edad && `, ${edad}`}
          </p>
        </div>
        <a href={mascota.carnetUrl} target="_blank" rel="noreferrer" className="boton boton-contorno">
          <FileDown size={18} aria-hidden="true" /> Carnet de vacunas
        </a>
      </header>

      {/* ---------- Próximos turnos ---------- */}
      <section className="bloque-dueno">
        <h3>
          <CalendarDays size={20} aria-hidden="true" /> Próximos turnos
        </h3>
        {mascota.turnos.length === 0 ? (
          <p className="vacio">
            No tiene turnos sacados. <Link to="/turno">Pedir un turno</Link>
          </p>
        ) : (
          <ul className="lista-turnos-dueno">
            {mascota.turnos.map((t) => {
              const sePuedeCancelar = new Date(t.fechaHoraInicio).getTime() - ahora >= horasCancelacion * 3600 * 1000
              return (
                <li key={t.id}>
                  <div>
                    <strong>
                      {diaLargo(diaDe(t.fechaHoraInicio))} a las {horaDe(t.fechaHoraInicio)}
                    </strong>
                    <span>
                      {t.servicio.nombre}
                      {t.estado === 'PENDIENTE' && ' · La clínica te lo va a confirmar por WhatsApp'}
                    </span>
                  </div>
                  {sePuedeCancelar ? (
                    <button type="button" className="boton boton-contorno" onClick={() => alCancelar(t.id)}>
                      Cancelar turno
                    </button>
                  ) : (
                    whatsappClinica && (
                      <a
                        className="boton-texto"
                        target="_blank"
                        rel="noreferrer"
                        href={enlaceWhatsapp(
                          whatsappClinica,
                          `Hola, no voy a poder ir al turno de ${mascota.nombre} del ${diaLargo(diaDe(t.fechaHoraInicio))} a las ${horaDe(t.fechaHoraInicio)}.`,
                        )}
                      >
                        <MessageCircle size={16} aria-hidden="true" /> Avisar que no voy
                      </a>
                    )
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ---------- Vacunas ---------- */}
      <section className="bloque-dueno">
        <h3>
          <Syringe size={20} aria-hidden="true" /> Vacunas y desparasitaciones
        </h3>
        {dosis.length === 0 ? (
          <p className="vacio">Todavía no hay vacunas registradas.</p>
        ) : (
          <ul className="lista-dosis">
            {dosis.map((a) => {
              const estado = estadoDosis(a, hoy)
              return (
                <li key={a.id}>
                  <div>
                    <strong>{a.producto}</strong>
                    <span>Aplicada el {FECHA_CORTA.format(new Date(a.fechaAplicacion))}</span>
                  </div>
                  <div className="dosis-proxima">
                    {a.fechaProximaDosis ? (
                      <>
                        <span>Próxima: {FECHA_CORTA.format(new Date(a.fechaProximaDosis))}</span>
                        {estado && <span className={`estado-dosis ${estado.clase}`}>{estado.texto}</span>}
                      </>
                    ) : (
                      <span className="ayuda">Sin refuerzo</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ---------- Visitas ---------- */}
      <section className="bloque-dueno">
        <h3>
          <Stethoscope size={20} aria-hidden="true" /> Visitas a la veterinaria
        </h3>
        {mascota.consultas.length === 0 ? (
          <p className="vacio">Todavía no hay visitas registradas.</p>
        ) : (
          <>
            <ul className="lista-visitas">
              {consultas.map((c) => (
                <li key={c.id}>
                  <span className="visita-fecha">{fechaCortaDe(c.fecha)}</span>
                  <div>
                    <strong>{c.motivo}</strong>
                    {c.tratamiento && <p>Indicaciones: {c.tratamiento}</p>}
                    <span className="ayuda">
                      Atendió {c.veterinario.nombre} {c.veterinario.apellido}
                      {c.pesoKg && ` · Peso: ${Number(c.pesoKg).toLocaleString('es-AR')} kg`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {mascota.consultas.length > CONSULTAS_A_LA_VISTA && (
              <button type="button" className="boton-texto" onClick={() => setTodasLasConsultas((v) => !v)}>
                {todasLasConsultas ? 'Ver menos' : `Ver todas las visitas (${mascota.consultas.length})`}
              </button>
            )}
          </>
        )}
      </section>
    </article>
  )
}

// Cuenta del dueño: sus mascotas con vacunas, visitas, próximos turnos y el carnet.
export function MiCuenta() {
  const { usuario } = useAuth()
  const { datos: sitio } = useSitio()
  const [datos, setDatos] = useState<DatosMiCuenta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(() => {
    apiGet<DatosMiCuenta>('/mi-cuenta')
      .then(setDatos)
      .catch(() => setError('No se pudieron cargar tus datos. Probá de nuevo en un rato.'))
  }, [])
  useEffect(cargar, [cargar])

  async function cancelar(turnoId: number) {
    if (!window.confirm('¿Seguro que querés cancelar este turno?')) return
    setError(null)
    try {
      await apiPatch(`/mi-cuenta/turnos/${turnoId}/cancelar`, {})
      setAviso('Listo, cancelamos el turno. ¡Gracias por avisar!')
      cargar()
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cancelar el turno.')
    }
  }

  const whatsappClinica = sitio?.clinica.whatsapp ?? null

  return (
    <main className="contenedor mi-cuenta">
      <section className="bienvenida">
        <IlustracionMascotas />
        <div>
          <h1>Hola, {usuario?.nombre}</h1>
          <p>Acá ves a tus mascotas: sus vacunas, sus visitas y tus próximos turnos.</p>
          <Link to="/turno" className="boton">
            <CalendarPlus size={20} aria-hidden="true" /> Pedir turno
          </Link>
        </div>
      </section>

      {error && <p className="mensaje-error">{error}</p>}
      {aviso && <p className="mensaje-exito">{aviso}</p>}

      {!datos ? (
        !error && <p className="cargando">Cargando…</p>
      ) : datos.mascotas.length === 0 ? (
        <div className="tarjeta mi-cuenta-vacia">
          <h2>Todavía no vemos mascotas en tu cuenta</h2>
          <p>
            Si ya fuiste a la clínica, avisanos y la vinculamos con el teléfono que registraste. Si es tu primera vez,
            pedí un turno: en la consulta cargamos a tu mascota.
          </p>
          {whatsappClinica && (
            <a
              className="boton boton-whatsapp"
              target="_blank"
              rel="noreferrer"
              href={enlaceWhatsapp(whatsappClinica, 'Hola, me registré en la página y no veo a mi mascota en mi cuenta.')}
            >
              <MessageCircle size={18} aria-hidden="true" /> Escribir a la clínica
            </a>
          )}
        </div>
      ) : (
        <div className="lista-mascotas-dueno">
          {datos.mascotas.map((m) => (
            <TarjetaMascota
              key={m.id}
              mascota={m}
              horasCancelacion={datos.horasCancelacion ?? 24}
              whatsappClinica={whatsappClinica}
              alCancelar={cancelar}
            />
          ))}
        </div>
      )}
    </main>
  )
}
