import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiGet, apiPost, guardarToken, leerToken } from '../lib/api'
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
}

const AuthContext = createContext<ContextoAuth | null>(null)

// Guarda quién tiene la sesión iniciada y lo comparte con toda la aplicación.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  // Solo hay algo que cargar si quedó un token guardado de una visita anterior.
  const [cargando, setCargando] = useState(() => leerToken() !== null)

  // Al abrir la página, si hay un token guardado se recupera el usuario.
  useEffect(() => {
    if (!leerToken()) return
    apiGet<Usuario>('/auth/yo')
      .then(setUsuario)
      .catch(() => guardarToken(null))
      .finally(() => setCargando(false))
  }, [])

  async function ingresar(email: string, password: string) {
    const { token, usuario } = await apiPost<RespuestaSesion>('/auth/login', { email, password })
    guardarToken(token)
    setUsuario(usuario)
    return usuario
  }

  async function registrarse(datos: DatosRegistro) {
    const { token, usuario } = await apiPost<RespuestaSesion>('/auth/registro', datos)
    guardarToken(token)
    setUsuario(usuario)
    return usuario
  }

  function salir() {
    guardarToken(null)
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, ingresar, registrarse, salir }}>
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
