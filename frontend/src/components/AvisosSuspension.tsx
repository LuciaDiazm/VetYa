import { Ban, Check, MessageCircle, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPatch } from '../lib/api'
import { fechaCortaDe } from '../lib/fechas'
import { enlaceWhatsapp } from '../lib/sitio'
import type { ClienteSuspendido } from '../types'

// En "Hoy": dueños que el sistema suspendió solos por cancelar muchos turnos web seguidos.
// La clínica decide qué hacer: mantener la suspensión, levantarla o escribirle.
export function AvisosSuspension() {
  const [clientes, setClientes] = useState<ClienteSuspendido[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<ClienteSuspendido[]>('/clientes/suspensiones').then(setClientes).catch(() => {})
  }, [])

  async function decidir(id: number, accion: 'mantener' | 'levantar') {
    if (accion === 'levantar' && !window.confirm('¿Levantar la suspensión? Va a poder sacar turnos por la web otra vez.')) return
    setError(null)
    try {
      await apiPatch(`/clientes/${id}/suspension`, { accion })
      setClientes((lista) => lista.filter((c) => c.id !== id))
    } catch {
      setError('No se pudo guardar. Probá de nuevo.')
    }
  }

  if (clientes.length === 0) return null

  return (
    <section className="tarjeta bloque-ficha avisos-suspension" aria-labelledby="titulo-suspensiones">
      <div className="bloque-ficha-titulo">
        <h2 id="titulo-suspensiones">
          <Ban size={22} aria-hidden="true" /> Cancelan muchos turnos
        </h2>
      </div>
      <p className="ayuda">
        Estos dueños cancelaron varios turnos por la web en pocos días. Quedaron sin poder sacar turnos por la web hasta
        la fecha que dice; ustedes deciden si sigue así.
      </p>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <ul className="lista-avisos">
        {clientes.map((c) => (
          <li key={c.id} className="aviso">
            <span className="icono-circulo">
              <Ban size={22} aria-hidden="true" />
            </span>
            <div className="aviso-datos">
              <p className="aviso-titulo">
                <Link to={`/panel/clientes/${c.id}`}>
                  {c.nombre} {c.apellido}
                </Link>
              </p>
              <p className="aviso-detalle">
                {c.suspensionMotivo}. Sin turnos web hasta el {fechaCortaDe(c.suspendidoHasta)}.
              </p>
            </div>
            <div className="aviso-acciones aviso-acciones-fila">
              <button type="button" className="boton" onClick={() => decidir(c.id, 'mantener')}>
                <Check size={20} aria-hidden="true" /> Mantener
              </button>
              <button type="button" className="boton boton-contorno" onClick={() => decidir(c.id, 'levantar')}>
                <Undo2 size={20} aria-hidden="true" /> Levantar
              </button>
              <a
                href={enlaceWhatsapp(
                  c.telefono,
                  `Hola ${c.nombre}, te escribimos de la veterinaria. Vimos que cancelaste varios turnos en estos días: ¿está todo bien? Si necesitás un turno, escribinos por acá y lo coordinamos.`,
                )}
                target="_blank"
                rel="noreferrer"
                className="boton boton-whatsapp"
              >
                <MessageCircle size={20} aria-hidden="true" /> WhatsApp
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
