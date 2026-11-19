import { Ban, CalendarDays, CalendarPlus, MessageCircle, Paperclip, Pencil, ShieldAlert, Stethoscope, Syringe, TriangleAlert, X } from 'lucide-react'
import { BotonVolver } from '../../components/BotonVolver'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BotonesCarnet } from '../../components/BotonesCarnet'
import { CamposMascota } from '../../components/CamposMascota'
import { FilaAplicacion, type DatosAplicacion } from '../../components/FilaAplicacion'
import { AdjuntosMascota } from '../../components/AdjuntosMascota'
import { CorregirConsulta } from '../../components/CorregirConsulta'
import { FotoMascota } from '../../components/FotoMascota'
import { useAuth } from '../../context/AuthContext'
import { apiGet, apiPatch, apiPost, apiPut } from '../../lib/api'
import { esDeHoy, puede } from '../../lib/permisos'
import { diaDe, diaLargo, fechaCortaDe, horaDe, hoyArgentina } from '../../lib/fechas'
import { datosDeMascota, type DatosMascota } from '../../lib/formularios'
import { edadTexto, nombreEspecie, FECHA_CORTA, formatearTelefono } from '../../lib/mascotas'
import { estadoDosis, ultimasPorProducto } from '../../lib/sanitario'
import { enlaceWhatsapp } from '../../lib/sitio'
import type { AplicacionSanitaria, ConsultaResumen, FichaMascota } from '../../types'
import { IconoEspecie } from './Clientes'
import { Cargando } from '../../components/Cargando'

// "subió 0,4 kg" / "bajó 1,2 kg" respecto de la consulta anterior con peso.
function cambioDePeso(consultas: ConsultaResumen[], indice: number) {
  const actual = consultas[indice].pesoKg
  const anterior = consultas.slice(indice + 1).find((c) => c.pesoKg)?.pesoKg
  if (!actual || !anterior) return null
  const diferencia = Number(actual) - Number(anterior)
  if (Math.abs(diferencia) < 0.05) return 'igual que antes'
  const texto = Math.abs(diferencia).toLocaleString('es-AR', { maximumFractionDigits: 2 })
  return diferencia > 0 ? `subió ${texto} kg` : `bajó ${texto} kg`
}

export function MascotaDetalle() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const atiende = puede(usuario, 'clinica.escribir')
  const edita = puede(usuario, 'clientes.editar')
  const daTurnos = puede(usuario, 'turnos.dar')
  const [corrigiendo, setCorrigiendo] = useState<number | null>(null)
  const [mascota, setMascota] = useState<FichaMascota | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  // Qué se muestra de la historia: todo, solo vacunas o solo consultas
  const [ver, setVer] = useState<'todo' | 'vacunas' | 'consultas'>('todo')
  const [datos, setDatos] = useState<DatosMascota | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [hoy] = useState(hoyArgentina)

  const cargar = useCallback(() => {
    apiGet<FichaMascota>(`/mascotas/${id}`)
      .then(setMascota)
      .catch(() => setError('No se encontró la mascota.'))
  }, [id])
  useEffect(cargar, [cargar])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!datos) return
    setGuardando(true)
    setError(null)
    try {
      await apiPut(`/mascotas/${id}`, datos)
      setEditando(false)
      cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarActivo(activo: boolean) {
    if (!mascota) return
    const pregunta = activo
      ? `¿Volver a mostrar a ${mascota.nombre} como mascota activa?`
      : `¿Marcar que ${mascota.nombre} ya no se atiende? (por ejemplo, si falleció o se mudó). Su historia clínica se conserva.`
    if (!window.confirm(pregunta)) return
    await apiPatch(`/mascotas/${id}/activo`, { activo })
    cargar()
  }

  // Una vacuna mal cargada no se borra: se anula con el motivo y queda tachada (deja de avisar y de salir en el carnet).
  async function anularAplicacion(a: AplicacionSanitaria) {
    const motivo = window.prompt(
      `¿Por qué se anula ${a.producto} del ${FECHA_CORTA.format(new Date(a.fechaAplicacion))}? (queda anotado)`,
      'Cargada por error',
    )
    if (!motivo?.trim()) return
    try {
      await apiPatch(`/consultas/aplicaciones/${a.id}/anular`, { motivo: motivo.trim() })
      cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anular')
    }
  }
  const puedeAnular = (a: AplicacionSanitaria) =>
    !a.anulada &&
    (puede(usuario, 'vacunas.anular') ||
      (atiende && a.registradoPor?.id === usuario?.id && !!a.creadoEn && esDeHoy(a.creadoEn)))
  const puedeCorregir = (c: ConsultaResumen) =>
    atiende && (usuario?.rol === 'ADMIN' || (c.veterinario.id === usuario?.id && esDeHoy(c.fecha)))

  if (!mascota) {
    return error ? <p className="mensaje-error">{error}</p> : <Cargando />
  }

  const { cliente } = mascota
  const edad = edadTexto(mascota.fechaNacimiento)
  const dosis = ultimasPorProducto(mascota.aplicaciones)
  const anuladas = mascota.aplicaciones.filter((a) => a.anulada)

  return (
    <>
      <BotonVolver siNoHay={`/panel/clientes/${cliente.id}`} />

      {/* Igual que la ficha del cliente: datos y botones al costado; vacunas, turnos e historia clínica a la derecha */}
      <div className="ficha-con-costado">
        <aside className="tarjeta ficha-costado" aria-label={`Datos de ${mascota.nombre}`}>
          <FotoMascota
            mascotaId={mascota.id}
            nombre={mascota.nombre}
            fotoUrl={mascota.fotoUrl}
            editable={edita && !editando}
            alCambiar={(fotoUrl) => setMascota({ ...mascota, fotoUrl })}
            sinFoto={
              <span className="icono-circulo icono-grande">
                <IconoEspecie especie={mascota.especie} size={30} />
              </span>
            }
          />
          <h1>{mascota.nombre}</h1>
          <p className="ficha-costado-bajada">
            {[nombreEspecie(mascota), mascota.sexo === 'HEMBRA' ? 'hembra' : 'macho', mascota.raza, edad]
              .filter(Boolean)
              .join(', ')}
          </p>
          {/* Arriba de todo, al lado del nombre: se ve primero también en el celular */}
          {mascota.alergias && (
            <p className="aviso-alergia aviso-alergia-costado" role="note">
              <ShieldAlert size={20} aria-hidden="true" />
              <span>
                <strong>Alergias:</strong> {mascota.alergias}
              </span>
            </p>
          )}
          {!mascota.activo && (
            <p className="ficha-inactiva">
              <Ban size={16} aria-hidden="true" /> Ya no se atiende
            </p>
          )}

          {editando && datos ? (
            <form className="formulario" onSubmit={guardar}>
              <CamposMascota datos={datos} cambiar={setDatos} />
              <div className="formulario-botones">
                <button type="submit" className="boton" disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button type="button" className="boton-texto" onClick={() => setEditando(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <dl className="ficha-costado-lista">
                <div>
                  <dt>Nacimiento</dt>
                  <dd className={mascota.fechaNacimiento ? undefined : 'sin-cargar'}>
                    {mascota.fechaNacimiento ? FECHA_CORTA.format(new Date(mascota.fechaNacimiento)) : 'Sin cargar'}
                  </dd>
                </div>
                <div>
                  <dt>Color</dt>
                  <dd className={mascota.color ? undefined : 'sin-cargar'}>{mascota.color ?? 'Sin cargar'}</dd>
                </div>
                <div>
                  <dt>Castración</dt>
                  <dd>{mascota.castrado ? 'Sí' : 'No'}</dd>
                </div>
                <div>
                  <dt>Microchip</dt>
                  <dd className={mascota.microchip ? 'dato-numero' : 'sin-cargar'}>{mascota.microchip ?? 'Sin cargar'}</dd>
                </div>
                <div>
                  <dt>Dueño</dt>
                  <dd>
                    <Link to={`/panel/clientes/${cliente.id}`}>
                      {cliente.nombre} {cliente.apellido}
                    </Link>
                    <span className="ficha-costado-tel">{formatearTelefono(cliente.telefono)}</span>
                  </dd>
                </div>
              </dl>
              <div className="ficha-costado-botones">
                {atiende && mascota.activo && (
                  <Link to={`/panel/mascotas/${mascota.id}/consulta`} className="boton boton-secundario">
                    <Stethoscope size={20} aria-hidden="true" /> Nueva consulta
                  </Link>
                )}
                <a
                  href={enlaceWhatsapp(cliente.telefono, `Hola ${cliente.nombre}, te escribimos de la veterinaria por ${mascota.nombre}.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="boton boton-whatsapp"
                >
                  <MessageCircle size={20} aria-hidden="true" /> Escribir a {cliente.nombre}
                </a>
                {daTurnos && mascota.activo && (
                  <Link to={`/panel/agenda/nuevo?mascota=${mascota.id}`} className="boton boton-contorno">
                    <CalendarPlus size={20} aria-hidden="true" /> Dar turno
                  </Link>
                )}
                {edita && (
                  <button
                    type="button"
                    className="boton boton-contorno"
                    onClick={() => {
                      setDatos(datosDeMascota(mascota))
                      setEditando(true)
                    }}
                  >
                    <Pencil size={18} aria-hidden="true" /> Editar datos
                  </button>
                )}
              </div>
              {edita && (
                <button
                  type="button"
                  className={`boton-texto ficha-costado-extra ${mascota.activo ? 'texto-peligro' : ''}`}
                  onClick={() => cambiarActivo(!mascota.activo)}
                >
                  {mascota.activo ? 'Marcar que ya no se atiende' : 'Volver a marcar como activa'}
                </button>
              )}
            </>
          )}
        </aside>

        <div className="ficha-principal">
          {error && <p className="mensaje-error">{error}</p>}
          {mascota.observaciones && (
            <p className="observaciones">
              <TriangleAlert size={20} aria-hidden="true" /> {mascota.observaciones}
            </p>
          )}

          {/* ---------- Turnos (solo si tiene alguno pendiente) ---------- */}
          {mascota.turnos.length > 0 && (
            <section className="tarjeta bloque-ficha">
              <div className="bloque-ficha-titulo">
                <h2>
                  <CalendarDays size={22} aria-hidden="true" /> Próximos turnos
                </h2>
              </div>
              <ul className="lista-turnos-mascota">
                {mascota.turnos.map((t) => {
                  const dia = diaDe(t.fechaHoraInicio)
                  return (
                    <li key={t.id}>
                      <span>
                        <strong>{t.servicio.nombre}</strong>
                        <span>
                          {dia === hoy ? 'Hoy' : diaLargo(dia)} a las {horaDe(t.fechaHoraInicio)}
                        </span>
                      </span>
                      {atiende && dia === hoy && (
                        <Link to={`/panel/mascotas/${mascota.id}/consulta?turno=${t.id}`} className="boton">
                          Atender
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* ---------- Ver todo, solo vacunas o solo consultas (si tiene de las dos cosas) ---------- */}
          {dosis.length > 0 && mascota.consultas.length > 0 && (
            <div className="chips ficha-ver" role="group" aria-label="Qué mostrar">
              {(
                [
                  ['todo', 'Todo'],
                  ['vacunas', 'Solo vacunas'],
                  ['consultas', 'Solo consultas'],
                ] as const
              ).map(([valor, texto]) => (
                <button
                  key={valor}
                  type="button"
                  className={`chip${ver === valor ? ' chip-activo' : ''}`}
                  aria-pressed={ver === valor}
                  onClick={() => setVer(valor)}
                >
                  {texto}
                </button>
              ))}
            </div>
          )}

          {/* ---------- Vacunas y desparasitaciones ---------- */}
          {ver !== 'consultas' && (
          <section className="tarjeta bloque-ficha">
            <div className="bloque-ficha-titulo">
              <h2>
                <Syringe size={22} aria-hidden="true" /> Vacunas y desparasitaciones
              </h2>
            </div>
            {dosis.length === 0 ? (
              <p className="vacio">Todavía no tiene vacunas ni desparasitaciones registradas.</p>
            ) : (
              <ul className="lista-dosis">
                {dosis.map((a) => {
                  const estado = estadoDosis(a, hoy)
                  return (
                    <li key={a.id}>
                      <div>
                        <strong>{a.producto}</strong>
                        <span>
                          {a.tipo === 'VACUNA' ? 'Vacuna' : 'Desparasitación'}, aplicada el{' '}
                          {FECHA_CORTA.format(new Date(a.fechaAplicacion))}
                        </span>
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
                        {puedeAnular(a) && (
                          <button
                            type="button"
                            className="boton-icono"
                            onClick={() => anularAplicacion(a)}
                            aria-label={`Anular ${a.producto}`}
                            title="Anular (cargada por error)"
                          >
                            <X size={18} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {anuladas.length > 0 && (
              <details className="dosis-anuladas">
                <summary>
                  {anuladas.length === 1 ? '1 anulada (cargada por error)' : `${anuladas.length} anuladas (cargadas por error)`}
                </summary>
                <ul>
                  {anuladas.map((a) => (
                    <li key={a.id}>
                      <s>{a.producto}</s> del {FECHA_CORTA.format(new Date(a.fechaAplicacion))}
                      <span className="ayuda">
                        {' '}
                        · “{a.motivoAnulacion}”{a.anuladaPor && `, anuló ${a.anuladaPor.nombre} ${a.anuladaPor.apellido}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {atiende && mascota.activo && <AplicacionAnterior mascota={mascota} alGuardar={cargar} />}
            {dosis.length > 0 && <BotonesCarnet mascota={mascota} cliente={cliente} />}
          </section>
          )}

          {/* ---------- Historia clínica: una línea con un punto por consulta, la más nueva arriba ---------- */}
          {ver !== 'vacunas' && (
          <section className="tarjeta bloque-ficha">
            <div className="bloque-ficha-titulo">
              <h2>
                <Stethoscope size={22} aria-hidden="true" /> Historia clínica
              </h2>
            </div>
            {mascota.consultas.length === 0 ? (
              <p className="vacio">Todavía no tiene consultas registradas.</p>
            ) : (
              <ol className="lista-consultas historia-linea">
                {mascota.consultas.map((c, i) => {
                  const cambio = cambioDePeso(mascota.consultas, i)
                  if (corrigiendo === c.id) {
                    return (
                      <li key={c.id}>
                        <p className="consulta-fecha">{fechaCortaDe(c.fecha)}</p>
                        <CorregirConsulta
                          consulta={c}
                          alTerminar={(guardada) => {
                            setCorrigiendo(null)
                            if (guardada) cargar()
                          }}
                        />
                      </li>
                    )
                  }
                  return (
                    <li key={c.id}>
                      <p className="consulta-fecha">{fechaCortaDe(c.fecha)}</p>
                      <p className="consulta-cabecera">
                        <strong>{c.motivo}</strong>
                      </p>
                      {(c.pesoKg || c.temperatura) && (
                        <p className="consulta-signos">
                          {c.pesoKg && (
                            <span>
                              Peso: <strong>{Number(c.pesoKg).toLocaleString('es-AR')} kg</strong>
                              {cambio && ` (${cambio})`}
                            </span>
                          )}
                          {c.temperatura && (
                            <span>
                              Temperatura: <strong>{Number(c.temperatura).toLocaleString('es-AR')} °C</strong>
                            </span>
                          )}
                        </p>
                      )}
                      {c.diagnostico && (
                        <p>
                          <strong>Diagnóstico:</strong> {c.diagnostico}
                        </p>
                      )}
                      {c.tratamiento && (
                        <p>
                          <strong>Tratamiento:</strong> {c.tratamiento}
                        </p>
                      )}
                      {c.observaciones && <p className="ayuda">{c.observaciones}</p>}
                      {c.aplicaciones.length > 0 && (
                        <p className="chips chips-chicas">
                          {c.aplicaciones.map((a) => (
                            <span key={a.id} className="chip-dato">
                              <Syringe size={14} aria-hidden="true" /> {a.anulada ? <s>{a.producto} (anulada)</s> : a.producto}
                            </span>
                          ))}
                        </p>
                      )}
                      {c.reservada && <p className="ayuda">El detalle clínico lo ve quien atiende.</p>}
                      <p className="ayuda">
                        Atendió {c.veterinario.nombre} {c.veterinario.apellido}
                        {c.turno ? ` (turno de ${c.turno.servicio.nombre.toLowerCase()})` : ''}
                        {c.editadaEn &&
                          ` · Corregida${c.editadaPor ? ` por ${c.editadaPor.nombre} ${c.editadaPor.apellido}` : ''} el ${fechaCortaDe(c.editadaEn)}`}
                      </p>
                      {puedeCorregir(c) && (
                        <button type="button" className="boton-texto enlace-chico" onClick={() => setCorrigiendo(c.id)}>
                          <Pencil size={14} aria-hidden="true" /> Corregir
                        </button>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
          )}

          {/* ---------- Análisis y estudios (lo clínico: no lo ve recepción) ---------- */}
          {puede(usuario, 'clinica.ver') && ver !== 'vacunas' && (
            <section className="tarjeta bloque-ficha">
              <div className="bloque-ficha-titulo">
                <h2>
                  <Paperclip size={22} aria-hidden="true" /> Análisis y estudios
                </h2>
              </div>
              <AdjuntosMascota
                mascotaId={mascota.id}
                adjuntos={mascota.adjuntos}
                consultas={mascota.consultas}
                usuario={usuario}
                puedeSubir={atiende && mascota.activo}
                alCambiar={cargar}
              />
            </section>
          )}
        </div>
      </div>
    </>
  )
}

// Registrar una vacuna o desparasitación que se aplicó antes (por ejemplo, la que figura en la libreta de papel).
function AplicacionAnterior({ mascota, alGuardar }: { mascota: FichaMascota; alGuardar: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(hoyArgentina)
  const [datos, setDatos] = useState<DatosAplicacion>({ tipo: 'VACUNA', producto: '', lote: '', fechaProximaDosis: '' })
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      await apiPost('/consultas/aplicaciones', {
        mascotaId: mascota.id,
        tipo: datos.tipo,
        producto: datos.producto,
        lote: datos.lote || undefined,
        fechaAplicacion: fecha,
        fechaProximaDosis: datos.fechaProximaDosis || undefined,
      })
      setAbierto(false)
      setDatos({ tipo: 'VACUNA', producto: '', lote: '', fechaProximaDosis: '' })
      alGuardar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (!abierto) {
    return (
      <button type="button" className="boton-texto enlace-chico" onClick={() => setAbierto(true)}>
        + Cargar una vacuna o desparasitación anterior (de la libreta)
      </button>
    )
  }

  return (
    <form className="formulario subformulario" onSubmit={guardar}>
      <label className="campo campo-fecha">
        ¿Cuándo se aplicó?
        <input type="date" value={fecha} max={hoyArgentina()} onChange={(e) => setFecha(e.target.value)} required />
      </label>
      <FilaAplicacion datos={datos} cambiar={setDatos} especie={mascota.especie} desde={fecha} />
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <div className="formulario-botones">
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="boton-texto" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
