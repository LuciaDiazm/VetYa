import { Camera, KeyRound, Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiSubir } from '../../../lib/api'
import { formatearTelefono } from '../../../lib/mascotas'
import { olvidarSitio } from '../../../lib/sitio'
import type { Personal } from '../../../types'
import { Cargando } from '../../../components/Cargando'

const ROLES = { VETERINARIO: 'Veterinaria/o', ADMIN: 'Veterinaria/o a cargo' } as const

interface Formulario {
  nombre: string
  apellido: string
  email: string
  telefono: string
  rol: Personal['rol']
  password: string
  visibleEnWeb: boolean
  matricula: string
  especialidad: string
  presentacion: string
}

const NUEVO: Formulario = {
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  rol: 'VETERINARIO',
  password: '',
  visibleEnWeb: false,
  matricula: '',
  especialidad: '',
  presentacion: '',
}

function aFormulario(p: Personal): Formulario {
  return {
    nombre: p.nombre,
    apellido: p.apellido,
    email: p.email,
    telefono: p.telefono ? formatearTelefono(p.telefono) : '',
    rol: p.rol,
    password: '',
    visibleEnWeb: p.visibleEnWeb,
    matricula: p.matricula ?? '',
    especialidad: p.especialidad ?? '',
    presentacion: p.presentacion ?? '',
  }
}

function iniciales(p: Personal) {
  return `${p.nombre[0] ?? ''}${p.apellido[0] ?? ''}`.toUpperCase()
}

function FormularioPersona({
  inicial,
  esNueva,
  esUnoMismo,
  alGuardar,
  alCancelar,
}: {
  inicial: Formulario
  esNueva: boolean
  esUnoMismo: boolean
  alGuardar: (datos: Formulario) => Promise<void>
  alCancelar: () => void
}) {
  const [datos, setDatos] = useState(inicial)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const poner = <K extends keyof Formulario>(clave: K, valor: Formulario[K]) => setDatos({ ...datos, [clave]: valor })

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      await alGuardar(datos)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setGuardando(false)
    }
  }

  return (
    <form className="formulario formulario-en-lista" onSubmit={enviar}>
      <div className="fila-campos">
        <label className="campo">
          Nombre
          <input value={datos.nombre} onChange={(e) => poner('nombre', e.target.value)} required />
        </label>
        <label className="campo">
          Apellido
          <input value={datos.apellido} onChange={(e) => poner('apellido', e.target.value)} required />
        </label>
      </div>
      <div className="fila-campos">
        <label className="campo">
          Email (para ingresar)
          <input type="email" value={datos.email} onChange={(e) => poner('email', e.target.value)} required />
        </label>
        <label className="campo">
          Teléfono (opcional)
          <input type="tel" value={datos.telefono} onChange={(e) => poner('telefono', e.target.value)} />
        </label>
      </div>
      <div className="fila-campos">
        <label className="campo">
          Qué puede hacer
          <select
            value={datos.rol}
            onChange={(e) => poner('rol', e.target.value as Formulario['rol'])}
            disabled={esUnoMismo}
          >
            <option value="ADMIN">Veterinaria/o a cargo</option>
            <option value="VETERINARIO">Veterinaria/o</option>
          </select>
          <span className="ayuda">
            {datos.rol === 'ADMIN'
              ? 'Hace todo, también cambiar estos ajustes. Es la cuenta de quien está a cargo de la clínica.'
              : 'Para un segundo profesional: agenda, clientes, historia clínica, pagos y avisos, sin Ajustes.'}
          </span>
        </label>
        {esNueva && (
          <label className="campo">
            Contraseña inicial
            <input
              type="text"
              autoComplete="new-password"
              minLength={8}
              value={datos.password}
              onChange={(e) => poner('password', e.target.value)}
              required
            />
            <span className="ayuda">Al menos 8 caracteres. Pasásela en persona.</span>
          </label>
        )}
      </div>

      <label className="casilla">
        <input type="checkbox" checked={datos.visibleEnWeb} onChange={(e) => poner('visibleEnWeb', e.target.checked)} />
        Mostrar en “Nuestro equipo” de la web
      </label>
      {datos.visibleEnWeb && (
        <>
          <div className="fila-campos">
            <label className="campo">
              Especialidad (opcional)
              <input
                value={datos.especialidad}
                onChange={(e) => poner('especialidad', e.target.value)}
                placeholder="Clínica de pequeños animales"
              />
            </label>
            <label className="campo">
              Matrícula (opcional)
              <input value={datos.matricula} onChange={(e) => poner('matricula', e.target.value)} placeholder="M.P. 0000" />
            </label>
          </div>
          <label className="campo">
            Presentación corta (opcional)
            <textarea rows={2} value={datos.presentacion} onChange={(e) => poner('presentacion', e.target.value)} />
          </label>
        </>
      )}

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <div className="formulario-botones">
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="boton-texto" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// Foto y contraseña: acciones sueltas de una persona del equipo.
function AccionesPersona({ persona, alCambiar }: { persona: Personal; alCambiar: () => void }) {
  const [cambiandoClave, setCambiandoClave] = useState(false)
  const [clave, setClave] = useState('')
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null)

  async function subirFoto(archivo: File | undefined) {
    if (!archivo) return
    setMensaje(null)
    const formulario = new FormData()
    formulario.append('foto', archivo)
    try {
      await apiSubir(`/usuarios/${persona.id}/foto`, formulario)
      olvidarSitio()
      alCambiar()
    } catch (err) {
      setMensaje({ texto: err instanceof Error ? err.message : 'No se pudo subir la foto', error: true })
    }
  }

  async function quitarFoto() {
    await apiDelete(`/usuarios/${persona.id}/foto`)
    olvidarSitio()
    alCambiar()
  }

  async function guardarClave(e: FormEvent) {
    e.preventDefault()
    try {
      await apiPatch(`/usuarios/${persona.id}/password`, { password: clave })
      setCambiandoClave(false)
      setClave('')
      setMensaje({ texto: 'Contraseña cambiada.', error: false })
    } catch (err) {
      setMensaje({ texto: err instanceof Error ? err.message : 'No se pudo cambiar', error: true })
    }
  }

  return (
    <>
      <div className="acciones-config">
        <label className="boton-texto enlace-chico subir-foto">
          <Camera size={16} aria-hidden="true" /> {persona.fotoUrl ? 'Cambiar foto' : 'Subir foto'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="solo-lectores"
            onChange={(e) => subirFoto(e.target.files?.[0])}
          />
        </label>
        {persona.fotoUrl && (
          <button type="button" className="boton-texto enlace-chico" onClick={quitarFoto}>
            Quitar foto
          </button>
        )}
        <button type="button" className="boton-texto enlace-chico" onClick={() => setCambiandoClave((v) => !v)}>
          <KeyRound size={16} aria-hidden="true" /> Nueva contraseña
        </button>
      </div>
      {cambiandoClave && (
        <form className="campo-en-linea" onSubmit={guardarClave}>
          <label className="campo">
            Contraseña nueva
            <input
              type="text"
              autoComplete="new-password"
              minLength={8}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="boton">
            Guardar
          </button>
        </form>
      )}
      {mensaje && <p className={mensaje.error ? 'mensaje-error' : 'mensaje-exito'}>{mensaje.texto}</p>}
    </>
  )
}

// Personal de la clínica: quién puede entrar al panel y quién aparece en la web.
export function PersonalClinica() {
  const { usuario } = useAuth()
  const [personal, setPersonal] = useState<Personal[] | null>(null)
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    apiGet<Personal[]>('/usuarios')
      .then(setPersonal)
      .catch(() => setError('No se pudo cargar el personal.'))
  }, [])
  useEffect(cargar, [cargar])

  async function guardar(id: number | 'nuevo', datos: Formulario) {
    if (id === 'nuevo') {
      const creado = await apiPost<Personal>('/usuarios', datos)
      // El alta crea la cuenta; el perfil para la web se guarda a continuación.
      await apiPut(`/usuarios/${creado.id}`, datos)
    } else {
      await apiPut(`/usuarios/${id}`, datos)
    }
    olvidarSitio()
    setEditando(null)
    cargar()
  }

  async function cambiarActivo(p: Personal) {
    if (p.activo && !window.confirm(`¿Desactivar a ${p.nombre}? No va a poder entrar al panel.`)) return
    setError(null)
    try {
      await apiPatch(`/usuarios/${p.id}/activo`, { activo: !p.activo })
      olvidarSitio()
      cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar')
    }
  }

  if (!personal) return error ? <p className="mensaje-error">{error}</p> : <Cargando />

  return (
    <section className="tarjeta">
      <div className="bloque-ficha-titulo">
        <h2>Personal</h2>
        {editando !== 'nuevo' && (
          <button type="button" className="boton" onClick={() => setEditando('nuevo')}>
            <Plus size={18} aria-hidden="true" /> Agregar persona
          </button>
        )}
      </div>
      {error && <p className="mensaje-error">{error}</p>}
      {editando === 'nuevo' && (
        <FormularioPersona
          inicial={NUEVO}
          esNueva
          esUnoMismo={false}
          alGuardar={(d) => guardar('nuevo', d)}
          alCancelar={() => setEditando(null)}
        />
      )}

      <ul className="lista-config">
        {personal.map((p) =>
          editando === p.id ? (
            <li key={p.id}>
              <FormularioPersona
                inicial={aFormulario(p)}
                esNueva={false}
                esUnoMismo={p.id === usuario?.id}
                alGuardar={(d) => guardar(p.id, d)}
                alCancelar={() => setEditando(null)}
              />
            </li>
          ) : (
            <li key={p.id} className={p.activo ? 'persona' : 'persona inactivo'}>
              {p.fotoUrl ? (
                <img src={p.fotoUrl} alt="" className="persona-avatar" />
              ) : (
                <span className="persona-avatar" aria-hidden="true">
                  {iniciales(p)}
                </span>
              )}
              <div className="persona-datos">
                <strong>
                  {p.nombre} {p.apellido}
                  {p.id === usuario?.id && <span className="ayuda"> (vos)</span>}
                </strong>
                <span className="ayuda">
                  {ROLES[p.rol]} · {p.email}
                  {p.visibleEnWeb && p.activo && ' · Aparece en la web'}
                  {!p.activo && ' · Desactivada/o'}
                </span>
                {p.activo && <AccionesPersona persona={p} alCambiar={cargar} />}
              </div>
              <div className="acciones-config">
                {p.activo && (
                  <button type="button" className="boton boton-contorno" onClick={() => setEditando(p.id)}>
                    <Pencil size={16} aria-hidden="true" /> Editar
                  </button>
                )}
                {p.id !== usuario?.id && (
                  <button type="button" className="boton-texto enlace-chico" onClick={() => cambiarActivo(p)}>
                    {p.activo ? 'Desactivar' : 'Volver a activar'}
                  </button>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}
