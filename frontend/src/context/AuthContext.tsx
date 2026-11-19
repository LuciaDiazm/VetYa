import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiGet, apiPost, marcarSesion } from '../lib/api'
import type { RespuestaSesion, Usuario } from '../types'

export interface DatosRegistro {
  nombre: string
  apellido: string
  email: string
  telefono: string
  password: string
}

interface ContextoAuth {
  usuario: Usuario | null
  cargando: boolean
  ingresar: (email: string, password: string) => Promise<Usuario>
  registrarse: (datos: DatosRegistro) => Promise<Usuario>
  salir: () => void
  actualizar: (usuario: Usuario) => void
}

const AuthContext = createContext<ContextoAuth | null>(null)

// Guarda quién tiene la sesión iniciada y lo comparte con toda la aplicación.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)

  function entrar(u: Usuario) {
    marcarSesion(true)
    setUsuario(u)
  }

  // Al abrir la página se pregunta si hay una sesión abierta (la cookie la manda el navegador solo).
  // Cada visita la renueva: así no se vence mientras sigan entrando.
  useEffect(() => {
    apiGet<Usuario>('/auth/yo')
      .then(entrar)
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  async function ingresar(email: string, password: string) {
    const { usuario } = await apiPost<RespuestaSesion>('/auth/login', { email, password })
    entrar(usuario)
    return usuario
  }

  async function registrarse(datos: DatosRegistro) {
    const { usuario } = await apiPost<RespuestaSesion>('/auth/registro', datos)
    entrar(usuario)
    return usuario
  }

  function salir() {
    marcarSesion(false)
    setUsuario(null)
    // El servidor borra la cookie. Si no hay conexión, igual se sale en esta pantalla.
    apiPost('/auth/salir', {}).catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, ingresar, registrarse, salir, actualizar: setUsuario }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return contexto
}

// Página a la que va cada rol después de iniciar sesión.
// eslint-disable-next-line react-refresh/only-export-components
export function rutaInicial(usuario: Usuario) {
  return usuario.rol === 'DUENIO' ? '/mi-cuenta' : '/panel'
}
