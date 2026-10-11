import { ArrowLeft, CalendarDays, MessageCircle, Pencil, Stethoscope, Syringe } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CamposMascota } from '../../components/CamposMascota'
import { datosDeMascota, type DatosMascota } from '../../lib/formularios'
import { apiGet, apiPatch, apiPut } from '../../lib/api'
import { edadTexto, ESPECIES, FECHA_CORTA, formatearTelefono } from '../../lib/mascotas'
import { enlaceWhatsapp } from '../../lib/sitio'
import type { AplicacionSanitaria, FichaMascota } from '../../types'
import { IconoEspecie } from './Clientes'

const FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

// Estado de una dosis según su fecha de próxima aplicación.
function estadoDosis(a: AplicacionSanitaria, hoy = new Date()) {
  if (!a.fechaProximaDosis) return null
  const dias = Math.ceil((new Date(a.fechaProximaDosis).getTime() - hoy.getTime()) / (24 * 3600 * 1000))
  if (dias < 0) return { clase: 'vencida', texto: 'Vencida' }
  if (dias <= 15) return { clase: 'por-vencer', texto: dias <= 1 ? 'Vence ya' : `Vence en ${dias} días` }
  return { clase: 'al-dia', texto: 'Al día' }
}

// Solo se muestra la última aplicación de cada producto: es la que dice cuándo toca la próxima.
function ultimasPorProducto(aplicaciones: AplicacionSanitaria[]) {
  const vistas = new Set<string>()
  return aplicaciones.filter((a) => {
    const clave = `${a.tipo}-${a.producto.toLowerCase()}`
    if (vistas.has(clave)) return false
    vistas.add(clave)
    return true
  })
}

export function MascotaDetalle() {
  const { id } = useParams()
  const [mascota, setMascota] = useState<FichaMascota | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [datos, setDatos] = useState<DatosMascota | null>(null)
  const [guardando, setGuardando] = useState(false)

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

  if (!mascota) {
    return error ? <p className="mensaje-error">{error}</p> : <p className="cargando">Cargando…</p>
  }

  const { cliente } = mascota
  const edad = edadTexto(mascota.fechaNacimiento)
  const dosis = ultimasPorProducto(mascota.aplicaciones)

  return (
    <>
      <Link to={`/panel/clientes/${cliente.id}`} className="volver">
        <ArrowLeft size={20} aria-hidden="true" /> {cliente.nombre} {cliente.apellido}
      </Link>

      <div className="panel-encabezado panel-encabezado-acciones">
        <div className="titulo-mascota">
          <span className="icono-circulo icono-grande">
            <IconoEspecie especie={mascota.especie} size={30} />
          </span>
          <div>
            <h1>{mascota.nombre}</h1>
            <p>
              {[ESPECIES[mascota.especie], mascota.sexo === 'HEMBRA' ? 'hembra' : 'macho', mascota.raza, edad]
                .filter(Boolean)
                .join(', ')}
              {!mascota.activo && <strong className="texto-peligro"> (ya no se atiende)</strong>}
            </p>
          </div>
        </div>
        <a
          href={enlaceWhatsapp(cliente.telefono, `Hola ${cliente.nombre}, te escribimos de la veterinaria por ${mascota.nombre}.`)}
          target="_blank"
          rel="noreferrer"
          className="boton boton-whatsapp"
        >
          <MessageCircle size={20} aria-hidden="true" /> Escribir a {cliente.nombre}
        </a>
      </div>

      {error && <p className="mensaje-error">{error}</p>}

      <div className="ficha-panel">
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
                const estado = estadoDosis(a)
                return (
                  <li key={a.id}>
                    <div>
                      <strong>{a.producto}</strong>
                      <span>
                        {a.tipo === 'VACUNA' ? 'Vacuna' : 'Desparasitación'}, aplicada el{' '}
                        {FECHA_CORTA.format(new Date(a.fechaAplicacion))}
                      </span>
                    </div>
                    {a.fechaProximaDosis && (
                      <div className="dosis-proxima">
                        <span>Próxima: {FECHA_CORTA.format(new Date(a.fechaProximaDosis))}</span>
                        {estado && <span className={`estado-dosis ${estado.clase}`}>{estado.texto}</span>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ---------- Próximos turnos ---------- */}
        <section className="tarjeta bloque-ficha">
          <div className="bloque-ficha-titulo">
            <h2>
              <CalendarDays size={22} aria-hidden="true" /> Próximos turnos
            </h2>
            {mascota.activo && (
              <Link to={`/panel/agenda/nuevo?mascota=${mascota.id}`} className="boton boton-secundario">
                Dar turno
              </Link>
            )}
          </div>
          {mascota.turnos.length === 0 ? (
            <p className="vacio">No tiene turnos pendientes.</p>
          ) : (
            <ul className="lista-simple">
              {mascota.turnos.map((t) => (
                <li key={t.id}>
                  <strong>{t.servicio.nombre}</strong>: {FECHA_HORA.format(new Date(t.fechaHoraInicio))}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Historia clínica ---------- */}
        <section className="tarjeta bloque-ficha ficha-ancho-completo">
          <div className="bloque-ficha-titulo">
            <h2>
              <Stethoscope size={22} aria-hidden="true" /> Historia clínica
            </h2>
          </div>
          {mascota.consultas.length === 0 ? (
            <p className="vacio">Todavía no tiene consultas registradas.</p>
          ) : (
            <ol className="lista-consultas">
              {mascota.consultas.map((c) => (
                <li key={c.id}>
                  <p className="consulta-cabecera">
                    <strong>{FECHA_CORTA.format(new Date(c.fecha))}</strong>, {c.motivo}
                  </p>
                  {c.diagnostico && <p>Diagnóstico: {c.diagnostico}</p>}
                  {c.tratamiento && <p>Tratamiento: {c.tratamiento}</p>}
                  <p className="ayuda">
                    Atendió {c.veterinario.nombre} {c.veterinario.apellido}
                    {c.pesoKg ? `. Peso: ${Number(c.pesoKg)} kg` : ''}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ---------- Datos ---------- */}
        <section className="tarjeta bloque-ficha ficha-ancho-completo">
          <div className="bloque-ficha-titulo">
            <h2>Datos de {mascota.nombre}</h2>
            {!editando && (
              <button
                type="button"
                className="boton boton-contorno"
                onClick={() => {
                  setDatos(datosDeMascota(mascota))
                  setEditando(true)
                }}
              >
                <Pencil size={18} aria-hidden="true" /> Editar
              </button>
            )}
          </div>

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
              <dl className="ficha-tabla">
                <div>
                  <dt>Nacimiento</dt>
                  <dd>
                    {mascota.fechaNacimiento ? FECHA_CORTA.format(new Date(mascota.fechaNacimiento)) : 'Sin cargar'}
                  </dd>
                </div>
                <div>
                  <dt>Color</dt>
                  <dd>{mascota.color ?? 'Sin cargar'}</dd>
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
                    </Link>{' '}
                    ({formatearTelefono(cliente.telefono)})
                  </dd>
                </div>
              </dl>
              {mascota.observaciones && <p className="observaciones">{mascota.observaciones}</p>}
              <button
                type="button"
                className={`boton-texto ${mascota.activo ? 'texto-peligro' : ''}`}
                onClick={() => cambiarActivo(!mascota.activo)}
              >
                {mascota.activo ? 'Marcar que ya no se atiende' : 'Volver a marcar como activa'}
              </button>
            </>
          )}
        </section>
      </div>
    </>
  )
}
