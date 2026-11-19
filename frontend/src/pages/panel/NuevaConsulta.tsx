import { Paperclip, Plus, ShieldAlert, X } from 'lucide-react'
import { BotonVolver } from '../../components/BotonVolver'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FilaAplicacion, type DatosAplicacion } from '../../components/FilaAplicacion'
import { apiGet, apiPost, apiSubir } from '../../lib/api'
import { esImagen, pesoArchivo, prepararArchivo, TAMANIO_MAXIMO } from '../../lib/imagenes'
import { fechaCortaDe, hoyArgentina } from '../../lib/fechas'
import { hayPantallaAnterior } from '../../lib/navegacion'
import { edadTexto, nombreEspecie } from '../../lib/mascotas'
import { alergiasMencionadas, dosisQueTocan, vacunaNueva } from '../../lib/sanitario'
import type { FichaMascota } from '../../types'
import { Cargando } from '../../components/Cargando'


// "12,5" o "12.5" → 12.5; vacío → null
function aNumero(texto: string) {
  const limpio = texto.replace(',', '.').trim()
  return limpio === '' ? null : Number(limpio)
}

// Cargar una consulta en la historia clínica. Si viene de un turno, al guardar el turno queda atendido.
export function NuevaConsulta() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const turnoId = parametros.get('turno') ? Number(parametros.get('turno')) : undefined
  const navegar = useNavigate()

  const [mascota, setMascota] = useState<FichaMascota | null>(null)
  const [motivo, setMotivo] = useState('')
  const [peso, setPeso] = useState('')
  const [temperatura, setTemperatura] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [tratamiento, setTratamiento] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [aplicaciones, setAplicaciones] = useState<DatosAplicacion[]>([])
  const [archivos, setArchivos] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    apiGet<FichaMascota>(`/mascotas/${id}`).then((m) => {
      setMascota(m)
      // Si viene de un turno, el motivo arranca con el servicio y lo que escribió el dueño.
      const turno = m.turnos.find((t) => t.id === turnoId)
      if (turno) setMotivo(turno.servicio.nombre)
    })
  }, [id, turnoId])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const pesoKg = aNumero(peso)
    const temp = aNumero(temperatura)
    if ((pesoKg !== null && Number.isNaN(pesoKg)) || (temp !== null && Number.isNaN(temp))) {
      setError('El peso y la temperatura tienen que ser números (por ejemplo 12,5)')
      return
    }
    setGuardando(true)
    try {
      const consulta = await apiPost<{ id: number }>('/consultas', {
        mascotaId: Number(id),
        turnoId,
        motivo,
        pesoKg,
        temperatura: temp,
        diagnostico: diagnostico || undefined,
        tratamiento: tratamiento || undefined,
        observaciones: observaciones || undefined,
        aplicaciones: aplicaciones.map((a) => ({
          tipo: a.tipo,
          producto: a.producto,
          lote: a.lote || undefined,
          fechaProximaDosis: a.fechaProximaDosis || undefined,
        })),
      })
      // Los análisis o fotos se suben después, ya asociados a esta consulta.
      const fallaron: string[] = []
      for (const archivo of archivos) {
        try {
          const listo = await prepararArchivo(archivo)
          if (listo.size > TAMANIO_MAXIMO) throw new Error('muy pesado')
          const formulario = new FormData()
          formulario.append('mascotaId', String(id))
          formulario.append('consultaId', String(consulta.id))
          formulario.append('archivo', listo)
          await apiSubir('/consultas/adjuntos', formulario)
        } catch {
          fallaron.push(archivo.name)
        }
      }
      if (fallaron.length > 0) {
        window.alert(`La consulta se guardó, pero no se pudo subir: ${fallaron.join(', ')}. Probá adjuntarlo desde la ficha.`)
      }
      // Vuelve a donde se tocó "Atender" o "Nueva consulta" (Hoy, Agenda o la ficha)
      if (hayPantallaAnterior()) navegar(-1)
      else navegar(`/panel/mascotas/${id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la consulta')
      setGuardando(false)
    }
  }

  if (!mascota) return <Cargando />

  const ultimoPeso = mascota.consultas.find((c) => c.pesoKg)
  const turno = mascota.turnos.find((t) => t.id === turnoId)
  // Vacunas y desparasitaciones vencidas o por vencer que todavía no se agregaron a esta consulta
  const yaAgregados = new Set(aplicaciones.map((a) => `${a.tipo}-${a.producto.toLowerCase()}`))
  const tocan = dosisQueTocan(mascota.aplicaciones, hoyArgentina()).filter(
    (d) => !yaAgregados.has(`${d.datos.tipo}-${d.datos.producto.toLowerCase()}`),
  )
  const pesoAnterior = ultimoPeso ? Number(ultimoPeso.pesoKg).toLocaleString('es-AR') : null
  // La temperatura no se completa sola (se mide en cada visita): solo se muestra la anterior para comparar.
  const ultimaTemperatura = mascota.consultas.find((c) => c.temperatura)
  const ojoAlergia = alergiasMencionadas(
    mascota.alergias,
    [tratamiento, diagnostico, ...aplicaciones.map((a) => a.producto)].join(' '),
  )

  function agregarArchivos(lista: FileList | null) {
    if (!lista) return
    const validos = [...lista].filter((f) => esImagen(f) || f.type === 'application/pdf')
    if (validos.length < lista.length) setError('Solo se pueden adjuntar fotos (JPG, PNG, WEBP) o PDF')
    setArchivos((actuales) => [...actuales, ...validos].slice(0, 5))
  }

  return (
    <>
      <BotonVolver siNoHay={`/panel/mascotas/${mascota.id}`} />
      <div className="panel-encabezado">
        <h1>Consulta de {mascota.nombre}</h1>
        <p>
          {[nombreEspecie(mascota), mascota.sexo === 'HEMBRA' ? 'hembra' : 'macho', mascota.raza, edadTexto(mascota.fechaNacimiento)]
            .filter(Boolean)
            .join(', ')}
          . Dueño: {mascota.cliente.nombre} {mascota.cliente.apellido}.
        </p>
      </div>

      {mascota.alergias && (
        <p className="aviso-alergia" role="note">
          <ShieldAlert size={22} aria-hidden="true" />
          <span>
            <strong>Alergias:</strong> {mascota.alergias}
          </span>
        </p>
      )}
      {mascota.observaciones && <p className="observaciones">⚠ {mascota.observaciones}</p>}
      {turno?.observaciones && <p className="aviso-pendientes">El dueño escribió al pedir el turno: “{turno.observaciones}”</p>}

      <form className="formulario formulario-animal" onSubmit={guardar}>
        <section className="tarjeta formulario">
          <label className="campo">
            Motivo de la consulta
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} required placeholder="Ej.: control anual" />
          </label>
          <div className="fila-campos">
            <label className="campo">
              Peso (kg)
              <input inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="Ej.: 12,5" />
              {ultimoPeso && pesoAnterior && (
                <span className="ayuda">
                  Último: {pesoAnterior} kg ({fechaCortaDe(ultimoPeso.fecha)}).{' '}
                  {peso !== pesoAnterior && (
                    <button type="button" className="boton-texto enlace-chico" onClick={() => setPeso(pesoAnterior)}>
                      Usar {pesoAnterior} kg
                    </button>
                  )}
                </span>
              )}
            </label>
            <label className="campo">
              Temperatura (°C)
              <input inputMode="decimal" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} placeholder="Ej.: 38,5" />
              {ultimaTemperatura?.temperatura && (
                <span className="ayuda">
                  La última vez: {Number(ultimaTemperatura.temperatura).toLocaleString('es-AR')} °C (
                  {fechaCortaDe(ultimaTemperatura.fecha)}).
                </span>
              )}
            </label>
          </div>
          <label className="campo">
            Diagnóstico
            <textarea value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} rows={2} />
          </label>
          <label className="campo">
            Tratamiento e indicaciones
            <textarea value={tratamiento} onChange={(e) => setTratamiento(e.target.value)} rows={3} />
          </label>
          {ojoAlergia.length > 0 && (
            <p className="aviso-alergia" role="alert">
              <ShieldAlert size={20} aria-hidden="true" />
              <span>
                Ojo: {mascota.nombre} es alérgic{mascota.sexo === 'HEMBRA' ? 'a' : 'o'} a <strong>{ojoAlergia.join(', ')}</strong> y
                lo escribiste en la consulta. Revisalo antes de guardar.
              </span>
            </p>
          )}
          <label className="campo">
            Observaciones (opcional)
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
          </label>
        </section>

        <section className="tarjeta formulario">
          <h2>Vacunas y desparasitaciones de hoy</h2>
          {tocan.length > 0 && (
            // Lo que le toca hoy, para agregarlo con un toque (producto y próxima fecha ya puestos)
            <div className="dosis-que-tocan">
              <p>Le toca:</p>
              <div className="chips">
                {tocan.map((d) => (
                  <button
                    key={`${d.datos.tipo}-${d.datos.producto}`}
                    type="button"
                    className="chip chip-grande"
                    onClick={() => setAplicaciones((lista) => [...lista, d.datos])}
                  >
                    <Plus size={18} aria-hidden="true" /> {d.datos.producto}{' '}
                    <span className={`dosis-estado ${d.estado.clase}`}>({d.estado.texto.toLowerCase()})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {aplicaciones.length === 0 && <p className="vacio">No se aplicó nada en esta consulta.</p>}
          {aplicaciones.map((a, i) => (
            <FilaAplicacion
              key={i}
              datos={a}
              especie={mascota.especie}
              cambiar={(nueva) => setAplicaciones((lista) => lista.map((x, j) => (j === i ? nueva : x)))}
              quitar={() => setAplicaciones((lista) => lista.filter((_, j) => j !== i))}
            />
          ))}
          <button
            type="button"
            className="boton boton-contorno"
            onClick={() => setAplicaciones((lista) => [...lista, vacunaNueva()])}
          >
            <Plus size={20} aria-hidden="true" /> Agregar vacuna o desparasitación
          </button>
        </section>

        <section className="tarjeta formulario">
          <h2>Análisis o estudios (opcional)</h2>
          <p className="ayuda">Fotos o PDF de hasta 8 MB: análisis, ecografías, radiografías.</p>
          {archivos.length > 0 && (
            <ul className="adjuntos-lista">
              {archivos.map((f, i) => (
                <li key={`${f.name}-${i}`}>
                  <Paperclip size={18} aria-hidden="true" className="adjunto-icono" />
                  <span className="adjunto-texto">
                    {f.name} <span className="ayuda">{pesoArchivo(f.size)}</span>
                  </span>
                  <button
                    type="button"
                    className="boton-icono"
                    onClick={() => setArchivos((lista) => lista.filter((_, j) => j !== i))}
                    aria-label={`Quitar ${f.name}`}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="adjuntos-subir">
            <input
              id="consulta-archivos"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="solo-lectores"
              onChange={(e) => {
                agregarArchivos(e.target.files)
                e.target.value = ''
              }}
            />
            <label htmlFor="consulta-archivos" className="boton boton-contorno">
              <Paperclip size={18} aria-hidden="true" /> Adjuntar archivo
            </label>
          </div>
        </section>

        {error && (
          <p className="mensaje-error" role="alert">
            {error}
          </p>
        )}

        <div className="formulario-botones">
          <button type="submit" className="boton boton-grande" disabled={guardando}>
            {guardando ? 'Guardando…' : turno ? 'Guardar y marcar el turno como atendido' : 'Guardar consulta'}
          </button>
        </div>
      </form>
    </>
  )
}
