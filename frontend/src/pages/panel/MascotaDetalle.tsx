import { ArrowLeft, Ban, CalendarDays, CalendarPlus, MessageCircle, Pencil, Stethoscope, Syringe, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BotonesCarnet } from '../../components/BotonesCarnet'
import { CamposMascota } from '../../components/CamposMascota'
import { FilaAplicacion, type DatosAplicacion } from '../../components/FilaAplicacion'
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../lib/api'
import { diaDe, diaLargo, fechaCortaDe, horaDe, hoyArgentina } from '../../lib/fechas'
import { datosDeMascota, type DatosMascota } from '../../lib/formularios'
import { edadTexto, ESPECIES, FECHA_CORTA, formatearTelefono } from '../../lib/mascotas'
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
  const [mascota, setMascota] = useState<FichaMascota | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
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

  async function borrarAplicacion(a: AplicacionSanitaria) {
    if (!window.confirm(`¿Borrar el registro de ${a.producto} del ${FECHA_CORTA.format(new Date(a.fechaAplicacion))}?`)) return
    await apiDelete(`/consultas/aplicaciones/${a.id}`)
    cargar()
  }

  if (!mascota) {
    return error ? <p className="mensaje-error">{error}</p> : <Cargando />
  }

  const { cliente } = mascota
  const edad = edadTexto(mascota.fechaNacimiento)
  const dosis = ultimasPorProducto(mascota.aplicaciones)

  return (
    <>
      <Link to={`/panel/clientes/${cliente.id}`} className="volver">
        <ArrowLeft size={20} aria-hidden="true" /> {cliente.nombre} {cliente.apellido}
      </Link>

      {/* Igual que la ficha del cliente: datos y botones al costado; vacunas, turnos e historia clínica a la derecha */}
      <div className="ficha-con-costado">
        <aside className="tarjeta ficha-costado" aria-label={`Datos de ${mascota.nombre}`}>
          <span className="icono-circulo icono-grande">
            <IconoEspecie especie={mascota.especie} size={30} />
          </span>
          <h1>{mascota.nombre}</h1>
          <p className="ficha-costado-bajada">
            {[ESPECIES[mascota.especie], mascota.sexo === 'HEMBRA' ? 'hembra' : 'macho', mascota.raza, edad]
              .filter(Boolean)
              .join(', ')}
          </p>
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
                {mascota.activo && (
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
                {mascota.activo && (
                  <Link to={`/panel/agenda/nuevo?mascota=${mascota.id}`} className="boton boton-contorno">
                    <CalendarPlus size={20} aria-hidden="true" /> Dar turno
                  </Link>
                )}
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
              </div>
              <button
                type="button"
                className={`boton-texto ficha-costado-extra ${mascota.activo ? 'texto-peligro' : ''}`}
                onClick={() => cambiarActivo(!mascota.activo)}
              >
                {mascota.activo ? 'Marcar que ya no se atiende' : 'Volver a marcar como activa'}
              </button>
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
                      {dia === hoy && (
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

          {/* ---------- Vacunas y desparasitaciones ---------- */}
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
                        <button
                          type="button"
                          className="boton-icono"
                          onClick={() => borrarAplicacion(a)}
                          aria-label={`Borrar ${a.producto}`}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {mascota.activo && <AplicacionAnterior mascota={mascota} alGuardar={cargar} />}
            {dosis.length > 0 && <BotonesCarnet mascota={mascota} cliente={cliente} />}
          </section>

          {/* ---------- Historia clínica: una línea con un punto por consulta, la más nueva arriba ---------- */}
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
                              <Syringe size={14} aria-hidden="true" /> {a.producto}
                            </span>
                          ))}
                        </p>
                      )}
                      <p className="ayuda">
                        Atendió {c.veterinario.nombre} {c.veterinario.apellido}
                        {c.turno ? ` (turno de ${c.turno.servicio.nombre.toLowerCase()})` : ''}
                      </p>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
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
