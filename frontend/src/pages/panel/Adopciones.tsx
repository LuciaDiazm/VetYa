import { MessageCircle, Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ESTADOS_ADOPCION, ESTADOS_SOLICITUD, fotoPrincipal, VIVIENDAS } from '../../lib/adopcion'
import { apiGet, apiPatch } from '../../lib/api'
import { enlaceWhatsapp } from '../../lib/sitio'
import type { AnimalAdopcion, EstadoAdopcion, EstadoSolicitud, SolicitudAdopcion } from '../../types'

const FECHA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Avisa al menú del panel que cambió la cantidad de solicitudes nuevas.
function avisarCambioSolicitudes() {
  window.dispatchEvent(new Event('solicitudes-actualizadas'))
}

export function Adopciones() {
  const [parametros, setParametros] = useSearchParams()
  const pestana = parametros.get('ver') === 'solicitudes' ? 'solicitudes' : 'animales'
  const [animales, setAnimales] = useState<AnimalAdopcion[] | null>(null)
  const [solicitudes, setSolicitudes] = useState<SolicitudAdopcion[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    Promise.all([
      apiGet<AnimalAdopcion[]>('/adopciones'),
      apiGet<SolicitudAdopcion[]>('/adopciones/solicitudes/lista'),
    ])
      .then(([a, s]) => {
        setAnimales(a)
        setSolicitudes(s)
      })
      .catch(() => setError('No se pudieron cargar las adopciones.'))
  }, [])

  useEffect(cargar, [cargar])

  async function cambiarEstadoAnimal(animal: AnimalAdopcion, estado: EstadoAdopcion) {
    const actualizado = await apiPatch<AnimalAdopcion>(`/adopciones/${animal.id}/estado`, { estado })
    setAnimales((lista) => lista?.map((a) => (a.id === animal.id ? { ...actualizado, _count: a._count } : a)) ?? null)
  }

  async function cambiarEstadoSolicitud(solicitud: SolicitudAdopcion, estado: EstadoSolicitud) {
    await apiPatch(`/adopciones/solicitudes/${solicitud.id}`, { estado })
    cargar()
    avisarCambioSolicitudes()
  }

  const nuevas = solicitudes?.filter((s) => s.estado === 'NUEVA').length ?? 0

  return (
    <>
      <div className="panel-encabezado panel-encabezado-acciones">
        <div>
          <h1>Adopciones</h1>
          <p>Publicá animales y respondé a las personas interesadas.</p>
        </div>
        <Link to="/panel/adopciones/nuevo" className="boton boton-grande boton-secundario">
          <Plus size={22} aria-hidden="true" /> Publicar animal
        </Link>
      </div>

      <div className="pestanas" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={pestana === 'animales'}
          className={pestana === 'animales' ? 'activa' : ''}
          onClick={() => setParametros({})}
        >
          Animales
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pestana === 'solicitudes'}
          className={pestana === 'solicitudes' ? 'activa' : ''}
          onClick={() => setParametros({ ver: 'solicitudes' })}
        >
          Solicitudes {nuevas > 0 && <span className="globo">{nuevas}</span>}
        </button>
      </div>

      {error && <p className="mensaje-error">{error}</p>}
      {!animales || !solicitudes ? (
        !error && <p className="cargando">Cargando…</p>
      ) : pestana === 'animales' ? (
        animales.length === 0 ? (
          <div className="tarjeta">
            <p className="vacio">
              Todavía no publicaste ningún animal. Tocá <strong>Publicar animal</strong> para empezar.
            </p>
          </div>
        ) : (
          <ul className="lista-panel-animales">
            {animales.map((a) => (
              <li key={a.id} className="panel-animal">
                <img src={fotoPrincipal(a)} alt="" />
                <div className="panel-animal-datos">
                  <strong>{a.nombre}</strong>
                  <span>
                    {a.especie === 'GATO' ? 'Gato' : 'Perro'}, {a.sexo === 'HEMBRA' ? 'hembra' : 'macho'}
                  </span>
                  {(a._count?.solicitudes ?? 0) > 0 && (
                    <Link to="/panel/adopciones?ver=solicitudes" className="aviso-solicitudes">
                      {a._count!.solicitudes} solicitud{a._count!.solicitudes > 1 ? 'es' : ''} nueva
                      {a._count!.solicitudes > 1 ? 's' : ''}
                    </Link>
                  )}
                </div>
                <div className="selector-estado" role="group" aria-label={`Estado de ${a.nombre}`}>
                  {(Object.keys(ESTADOS_ADOPCION) as EstadoAdopcion[]).map((e) => (
                    <button
                      key={e}
                      type="button"
                      className={`estado-${e}${a.estado === e ? ' activo' : ''}`}
                      aria-pressed={a.estado === e}
                      onClick={() => a.estado !== e && cambiarEstadoAnimal(a, e)}
                    >
                      {ESTADOS_ADOPCION[e]}
                    </button>
                  ))}
                </div>
                <Link to={`/panel/adopciones/${a.id}`} className="boton boton-contorno">
                  <Pencil size={18} aria-hidden="true" /> Editar
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : solicitudes.length === 0 ? (
        <div className="tarjeta">
          <p className="vacio">Todavía nadie pidió conocer a un animal. Cuando alguien lo haga, aparece acá.</p>
        </div>
      ) : (
        <ul className="lista-solicitudes">
          {solicitudes.map((s) => (
            <li key={s.id} className={`solicitud${s.estado === 'NUEVA' ? ' solicitud-nueva' : ''}`}>
              <img src={fotoPrincipal(s.animal)} alt="" />
              <div className="solicitud-datos">
                <p className="solicitud-titulo">
                  <strong>{s.nombre}</strong> quiere conocer a <strong>{s.animal.nombre}</strong>
                </p>
                <p className="solicitud-detalle">
                  {VIVIENDAS[s.vivienda]}. {s.otrosAnimales ? 'Tiene otros animales.' : 'No tiene otros animales.'}{' '}
                  Aceptó el compromiso.
                </p>
                {s.mensaje && <p className="solicitud-detalle">“{s.mensaje}”</p>}
                <p className="solicitud-fecha">
                  Recibida el {FECHA.format(new Date(s.creadaEn))}. Estado: {ESTADOS_SOLICITUD[s.estado].toLowerCase()}.
                </p>
                <div className="solicitud-acciones">
                  <a
                    href={enlaceWhatsapp(
                      s.telefono,
                      `Hola ${s.nombre.split(' ')[0]}, te escribimos de la veterinaria por tu pedido para conocer a ${s.animal.nombre}.`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="boton boton-whatsapp"
                    onClick={() => s.estado === 'NUEVA' && cambiarEstadoSolicitud(s, 'CONTACTADA')}
                  >
                    <MessageCircle size={18} aria-hidden="true" /> Escribirle
                  </a>
                  {s.estado !== 'APROBADA' && (
                    <button type="button" className="boton boton-contorno" onClick={() => cambiarEstadoSolicitud(s, 'APROBADA')}>
                      Aprobar
                    </button>
                  )}
                  {s.estado !== 'RECHAZADA' && (
                    <button type="button" className="boton-texto" onClick={() => cambiarEstadoSolicitud(s, 'RECHAZADA')}>
                      No avanzó
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
