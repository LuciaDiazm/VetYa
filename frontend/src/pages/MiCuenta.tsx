import { Ban, CalendarDays, CalendarPlus, FileDown, MessageCircle, PawPrint, Stethoscope, Syringe } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { GuiaVacunas } from '../components/GuiaVacunas'
import { useAuth } from '../context/AuthContext'
import { apiGet, apiPatch, ErrorApi } from '../lib/api'
import { diaDe, diaLargo, fechaCortaDe, horaDe, hoyArgentina } from '../lib/fechas'
import { edadTexto, ESPECIES, FECHA_CORTA } from '../lib/mascotas'
import { estadoDosis, ultimasPorProducto } from '../lib/sanitario'
import { enlaceWhatsapp, useSitio } from '../lib/sitio'
import type { DatosMiCuenta, MascotaDelDueno } from '../types'
import { IconoEspecie } from './panel/Clientes'

const CONSULTAS_A_LA_VISTA = 3

// "viernes, 20 de noviembre" → "Viernes, 20 de noviembre"
const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

type TurnoDelDueno = MascotaDelDueno['turnos'][number]
type ConsultaDelDueno = MascotaDelDueno['consultas'][number]

// ---------- Próximos turnos: lo más importante, arriba y bien grande ----------
function ProximosTurnos({
  turnos,
  horasCancelacion,
  whatsappClinica,
  alCancelar,
}: {
  turnos: { turno: TurnoDelDueno; mascota: MascotaDelDueno }[]
  horasCancelacion: number
  whatsappClinica: string | null
  alCancelar: (turnoId: number) => void
}) {
  const [ahora] = useState(() => Date.now())

  return (
    <section id="turnos" className="cuenta-seccion" aria-labelledby="titulo-turnos">
      <h2 id="titulo-turnos" className="cuenta-titulo">
        <CalendarDays size={26} aria-hidden="true" />
        {turnos.length === 1 ? 'Tu próximo turno' : 'Tus próximos turnos'}
      </h2>
      {turnos.length === 0 ? (
        <p className="cuenta-vacio">No tenés turnos sacados.</p>
      ) : (
        <ul className="turnos-dueno">
          {turnos.map(({ turno: t, mascota }) => {
            const dia = conMayuscula(diaLargo(diaDe(t.fechaHoraInicio)))
            const hora = horaDe(t.fechaHoraInicio)
            const sePuedeCancelar = new Date(t.fechaHoraInicio).getTime() - ahora >= horasCancelacion * 3600 * 1000
            return (
              <li key={t.id} className="turno-dueno">
                <p className="turno-dueno-mascota">
                  <IconoEspecie especie={mascota.especie} size={20} />
                  {mascota.nombre}
                </p>
                <p className="turno-dueno-dia">{dia}</p>
                <p className="turno-dueno-hora">{hora} h</p>
                <p className="turno-dueno-servicio">
                  {t.servicio.nombre}
                  {t.estado === 'PENDIENTE' && ' · La clínica te lo va a confirmar por WhatsApp'}
                </p>
                {sePuedeCancelar ? (
                  <button type="button" className="boton boton-contorno" onClick={() => alCancelar(t.id)}>
                    Cancelar turno
                  </button>
                ) : (
                  whatsappClinica && (
                    <a
                      className="boton boton-contorno"
                      target="_blank"
                      rel="noreferrer"
                      href={enlaceWhatsapp(
                        whatsappClinica,
                        `Hola, no voy a poder ir al turno de ${mascota.nombre} del ${diaLargo(diaDe(t.fechaHoraInicio))} a las ${hora}.`,
                      )}
                    >
                      <MessageCircle size={18} aria-hidden="true" /> Avisar que no voy
                    </a>
                  )
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ---------- Cada mascota con sus vacunas y el carnet ----------
// Las vacunas aparecen solas: cuando la clínica registra la que le puso, se ve acá y en el carnet.
function TarjetaMascota({ mascota }: { mascota: MascotaDelDueno }) {
  const [hoy] = useState(hoyArgentina)
  const dosis = ultimasPorProducto(mascota.aplicaciones)
  const edad = edadTexto(mascota.fechaNacimiento)

  return (
    <article className="mascota-dueno">
      {/* Huellita de adorno en la esquina contraria al nombre */}
      <PawPrint className="mascota-dueno-huella" aria-hidden="true" />
      <header className="mascota-dueno-encabezado">
        <span className="icono-circulo">
          <IconoEspecie especie={mascota.especie} size={26} />
        </span>
        <div>
          <h3>{mascota.nombre}</h3>
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

      {dosis.length === 0 ? (
        <p className="cuenta-vacio">
          <Syringe size={18} aria-hidden="true" /> Cuando le pongan una vacuna en la clínica, va a aparecer acá y en el
          carnet.
        </p>
      ) : (
        <section className="bloque-dueno" aria-label={`Vacunas de ${mascota.nombre}`}>
          <h4>
            <Syringe size={20} aria-hidden="true" /> Vacunas y desparasitaciones
          </h4>
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
        </section>
      )}
    </article>
  )
}

// ---------- Visitas de todas las mascotas, de la más nueva a la más vieja ----------
function Visitas({ visitas }: { visitas: { consulta: ConsultaDelDueno; mascota: MascotaDelDueno }[] }) {
  const [todas, setTodas] = useState(false)
  const aLaVista = todas ? visitas : visitas.slice(0, CONSULTAS_A_LA_VISTA)

  return (
    <section id="visitas" className="cuenta-seccion" aria-labelledby="titulo-visitas">
      <h2 id="titulo-visitas" className="cuenta-titulo">
        <Stethoscope size={26} aria-hidden="true" /> Visitas a la veterinaria
      </h2>
      {visitas.length === 0 ? (
        <p className="cuenta-vacio">Después de cada consulta, lo que te indicaron va a aparecer acá.</p>
      ) : (
        <div className="visitas-dueno">
          <ul className="lista-visitas">
            {aLaVista.map(({ consulta: c, mascota }) => (
              <li key={c.id}>
                <span className="visita-fecha">{fechaCortaDe(c.fecha)}</span>
                <div>
                  <strong>
                    {mascota.nombre}: {c.motivo}
                  </strong>
                  {c.tratamiento && <p>Indicaciones: {c.tratamiento}</p>}
                  <span className="ayuda">
                    Atendió {c.veterinario.nombre} {c.veterinario.apellido}
                    {c.pesoKg && ` · Peso: ${Number(c.pesoKg).toLocaleString('es-AR')} kg`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {visitas.length > CONSULTAS_A_LA_VISTA && (
            <button type="button" className="boton-texto" onClick={() => setTodas((v) => !v)}>
              {todas ? 'Ver menos' : `Ver todas las visitas (${visitas.length})`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

// Cuenta del dueño: próximos turnos, sus mascotas con vacunas y carnet, y las visitas.
export function MiCuenta() {
  const { usuario } = useAuth()
  const { datos: sitio } = useSitio()
  const [datos, setDatos] = useState<DatosMiCuenta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const { hash } = useLocation()

  const cargar = useCallback(() => {
    apiGet<DatosMiCuenta>('/mi-cuenta')
      .then(setDatos)
      .catch(() => setError('No se pudieron cargar tus datos. Probá de nuevo en un rato.'))
  }, [])
  useEffect(cargar, [cargar])

  // Los enlaces del encabezado ("Mis turnos", "Vacunas y carnet", "Visitas") bajan hasta su parte cuando ya cargó.
  useEffect(() => {
    if (datos && hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [datos, hash])

  // Turnos y visitas de todas las mascotas juntos, ordenados por fecha.
  const turnos = useMemo(
    () =>
      (datos?.mascotas ?? [])
        .flatMap((mascota) => mascota.turnos.map((turno) => ({ turno, mascota })))
        .sort((a, b) => a.turno.fechaHoraInicio.localeCompare(b.turno.fechaHoraInicio)),
    [datos],
  )
  const visitas = useMemo(
    () =>
      (datos?.mascotas ?? [])
        .flatMap((mascota) => mascota.consultas.map((consulta) => ({ consulta, mascota })))
        .sort((a, b) => b.consulta.fecha.localeCompare(a.consulta.fecha)),
    [datos],
  )

  async function cancelar(turnoId: number) {
    // Si con esta cancelación llega al límite, se le avisa antes que va a quedar sin turnos web por un tiempo.
    const limite = datos?.limiteCancelaciones ?? 0
    const llegaAlLimite = limite > 0 && (datos?.cancelacionesRecientes ?? 0) + 1 >= limite
    const pregunta = llegaAlLimite
      ? `¿Seguro que querés cancelar este turno?

Ojo: ya cancelaste varios turnos en estos días. Si cancelás este, no vas a poder sacar turnos por la web durante ${datos?.diasSuspension ?? 30} días (los vas a poder pedir por WhatsApp).`
      : '¿Seguro que querés cancelar este turno?'
    if (!window.confirm(pregunta)) return
    setError(null)
    try {
      const respuesta = await apiPatch<{ ok: boolean; suspendidoHasta: string | null }>(
        `/mi-cuenta/turnos/${turnoId}/cancelar`,
        {},
      )
      setAviso(
        respuesta.suspendidoHasta
          ? 'Listo, cancelamos el turno. Como cancelaste varios seguidos, por un tiempo los turnos se piden por WhatsApp.'
          : 'Listo, cancelamos el turno. ¡Gracias por avisar!',
      )
      cargar()
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cancelar el turno.')
    }
  }

  const whatsappClinica = sitio?.clinica.whatsapp ?? null

  return (
    <main className="mi-cuenta-fondo">
      <div className="contenedor mi-cuenta">
        {/* Saludo en un recuadro de vidrio. Es el único "Pedir turno" de la página (el del encabezado se oculta acá). */}
        <section className="bienvenida">
          <h1>
            <span className="bienvenida-hola">Hola,</span> {usuario?.nombre}
          </h1>
          <p>Acá ves a tus mascotas: sus vacunas, sus visitas y tus próximos turnos.</p>
          {!datos?.suspendidoHasta && (
            <Link to="/turno" className="boton boton-grande boton-brillo">
              <CalendarPlus size={22} aria-hidden="true" /> Pedir turno
            </Link>
          )}
        </section>

        {datos?.suspendidoHasta && (
          <div className="tarjeta aviso-suspendido" role="status">
            <Ban size={24} aria-hidden="true" />
            <div>
              <p>
                <strong>Por ahora no podés sacar turnos por la web</strong> (hasta el{' '}
                {fechaCortaDe(datos.suspendidoHasta)}), porque se cancelaron varios turnos seguidos. Escribinos y te
                damos un turno.
              </p>
              {whatsappClinica && (
                <a
                  className="boton boton-whatsapp"
                  target="_blank"
                  rel="noreferrer"
                  href={enlaceWhatsapp(whatsappClinica, 'Hola, quiero pedir un turno.')}
                >
                  <MessageCircle size={18} aria-hidden="true" /> Pedir turno por WhatsApp
                </a>
              )}
            </div>
          </div>
        )}

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
          <>
            <ProximosTurnos
              turnos={turnos}
              horasCancelacion={datos.horasCancelacion ?? 24}
              whatsappClinica={whatsappClinica}
              alCancelar={cancelar}
            />

            <section id="vacunas" className="cuenta-seccion" aria-labelledby="titulo-mascotas">
              <h2 id="titulo-mascotas" className="cuenta-titulo">
                <PawPrint size={26} aria-hidden="true" />
                {datos.mascotas.length === 1 ? 'Tu mascota' : 'Tus mascotas'}
              </h2>
              <div className="lista-mascotas-dueno">
                {datos.mascotas.map((m) => (
                  <TarjetaMascota key={m.id} mascota={m} />
                ))}
              </div>
            </section>

            <Visitas visitas={visitas} />
          </>
        )}

        {/* Guía de vacunas del primer año (antes estaba en el inicio) */}
        {datos && sitio && (
          <GuiaVacunas planes={sitio.planes} especies={datos.mascotas.map((m) => m.especie)} />
        )}
      </div>
    </main>
  )
}
