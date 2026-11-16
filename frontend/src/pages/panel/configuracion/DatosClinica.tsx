import { useEffect, useState, type FormEvent } from 'react'
import { apiGet, apiPut } from '../../../lib/api'
import { formatearTelefono } from '../../../lib/mascotas'
import { olvidarSitio } from '../../../lib/sitio'
import type { ClinicaConfig } from '../../../types'

interface Formulario {
  nombre: string
  direccion: string
  telefono: string
  whatsapp: string
  email: string
  instagram: string
  horasCancelacion: string
  limiteCancelaciones: string
  diasCancelaciones: string
  diasSuspension: string
  maxTurnosOnline: string
  telefonoUrgencias: string
  horarioUrgencias: string
}

function aFormulario(c: ClinicaConfig): Formulario {
  return {
    nombre: c.nombre,
    direccion: c.direccion,
    telefono: c.telefono,
    whatsapp: formatearTelefono(c.whatsapp),
    email: c.email ?? '',
    instagram: c.instagram ?? '',
    horasCancelacion: String(c.horasCancelacion),
    limiteCancelaciones: String(c.limiteCancelaciones),
    diasCancelaciones: String(c.diasCancelaciones),
    diasSuspension: String(c.diasSuspension),
    maxTurnosOnline: String(c.maxTurnosOnline),
    telefonoUrgencias: c.telefonoUrgencias ? formatearTelefono(c.telefonoUrgencias) : '',
    horarioUrgencias: c.horarioUrgencias ?? '',
  }
}

// Datos de contacto que se ven en la web, el pie de página, el carnet y los mensajes.
export function DatosClinica() {
  const [datos, setDatos] = useState<Formulario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    apiGet<ClinicaConfig>('/configuracion/clinica')
      .then((c) => setDatos(aFormulario(c)))
      .catch(() => setError('No se pudieron cargar los datos de la clínica.'))
  }, [])

  if (!datos) return error ? <p className="mensaje-error">{error}</p> : <p className="cargando">Cargando…</p>

  const poner = (clave: keyof Formulario, valor: string) => {
    setDatos({ ...datos, [clave]: valor })
    setGuardado(false)
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!datos) return
    setError(null)
    setGuardando(true)
    try {
      const c = await apiPut<ClinicaConfig>('/configuracion/clinica', {
        ...datos,
        horasCancelacion: Number(datos.horasCancelacion),
        limiteCancelaciones: Number(datos.limiteCancelaciones),
        diasCancelaciones: Number(datos.diasCancelaciones),
        diasSuspension: Number(datos.diasSuspension),
        maxTurnosOnline: Number(datos.maxTurnosOnline),
      })
      setDatos(aFormulario(c))
      setGuardado(true)
      olvidarSitio()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="formulario formulario-animal" onSubmit={guardar}>
      <section className="tarjeta formulario">
        <h2>Datos de contacto</h2>
        <label className="campo">
          Nombre de la clínica
          <input value={datos.nombre} onChange={(e) => poner('nombre', e.target.value)} required />
        </label>
        <label className="campo">
          Dirección
          <input value={datos.direccion} onChange={(e) => poner('direccion', e.target.value)} required />
        </label>
        <div className="fila-campos">
          <label className="campo">
            Teléfono (como se muestra en la web)
            <input value={datos.telefono} onChange={(e) => poner('telefono', e.target.value)} required />
          </label>
          <label className="campo">
            WhatsApp de la clínica
            <input type="tel" value={datos.whatsapp} onChange={(e) => poner('whatsapp', e.target.value)} required />
            <span className="ayuda">Con código de área. Es el número al que escriben los clientes desde la web.</span>
          </label>
        </div>
        <div className="fila-campos">
          <label className="campo">
            Email (opcional)
            <input type="email" value={datos.email} onChange={(e) => poner('email', e.target.value)} />
          </label>
          <label className="campo">
            Instagram (opcional)
            <input value={datos.instagram} onChange={(e) => poner('instagram', e.target.value)} placeholder="usuario" />
          </label>
        </div>
      </section>

      <section className="tarjeta formulario">
        <h2>Urgencias</h2>
        <div className="fila-campos">
          <label className="campo">
            Teléfono de urgencias (opcional)
            <input
              type="tel"
              value={datos.telefonoUrgencias}
              onChange={(e) => poner('telefonoUrgencias', e.target.value)}
            />
            <span className="ayuda">Si queda vacío, la página de urgencias muestra el WhatsApp de la clínica.</span>
          </label>
          <label className="campo">
            Horario de urgencias (opcional)
            <input
              value={datos.horarioUrgencias}
              onChange={(e) => poner('horarioUrgencias', e.target.value)}
              placeholder="Todos los días de 8 a 22 h"
            />
          </label>
        </div>
      </section>

      <section className="tarjeta formulario">
        <h2>Turnos</h2>
        <label className="campo campo-corto">
          Horas de anticipación para cancelar un turno desde la web
          <input
            type="number"
            min={0}
            max={168}
            value={datos.horasCancelacion}
            onChange={(e) => poner('horasCancelacion', e.target.value)}
            required
          />
          <span className="ayuda">Con menos tiempo, el dueño tiene que avisar por WhatsApp.</span>
        </label>
        <label className="campo campo-corto">
          Turnos por la web que puede tener a la vez cada dueño
          <input
            type="number"
            min={0}
            max={20}
            value={datos.maxTurnosOnline}
            onChange={(e) => poner('maxTurnosOnline', e.target.value)}
            required
          />
          <span className="ayuda">Con 0 no hay límite. Los turnos que dan ustedes no cuentan.</span>
        </label>
      </section>

      <section className="tarjeta formulario">
        <h2>Si cancelan muchos turnos</h2>
        <p className="ayuda">
          Si un dueño cancela por la web muchos turnos en pocos días, queda un tiempo sin poder sacar turnos por la web
          (los puede pedir por WhatsApp). Les aparece un aviso en "Hoy" y ustedes deciden si lo mantienen o lo levantan.
        </p>
        <div className="fila-campos">
          <label className="campo">
            Cantidad de cancelaciones
            <input
              type="number"
              min={0}
              max={20}
              value={datos.limiteCancelaciones}
              onChange={(e) => poner('limiteCancelaciones', e.target.value)}
              required
            />
            <span className="ayuda">Con 0 no se suspende a nadie solo.</span>
          </label>
          <label className="campo">
            En cuántos días
            <input
              type="number"
              min={1}
              max={90}
              value={datos.diasCancelaciones}
              onChange={(e) => poner('diasCancelaciones', e.target.value)}
              required
            />
          </label>
          <label className="campo">
            Días sin turnos web
            <input
              type="number"
              min={1}
              max={365}
              value={datos.diasSuspension}
              onChange={(e) => poner('diasSuspension', e.target.value)}
              required
            />
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
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {guardado && <p className="mensaje-exito">Listo, los cambios ya se ven en la web.</p>}
      </div>
    </form>
  )
}
