import { descargarArchivo } from './descargas'

// Funciones para comunicarse con el backend.

const CLAVE_TOKEN = 'vetya_token'

export function guardarToken(token: string | null) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token)
    else localStorage.removeItem(CLAVE_TOKEN)
  } catch {
    // Si el navegador bloquea el almacenamiento, la sesión dura hasta recargar la página.
  }
}

export function leerToken(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN)
  } catch {
    return null
  }
}

// Error con el mensaje que devuelve el backend, para mostrarlo en pantalla.
export class ErrorApi extends Error {
  status: number
  datos: Record<string, unknown> | null // el cuerpo completo de la respuesta, por si trae datos extra
  constructor(status: number, mensaje: string, datos: Record<string, unknown> | null = null) {
    super(mensaje)
    this.status = status
    this.datos = datos
  }
}

async function apiFetch<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const token = leerToken()
  const respuesta = await fetch(`/api${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  })
  const cuerpo = respuesta.status === 204 ? null : await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    // La sesión ya no vale (se cambió la contraseña, se desactivó la cuenta o venció): se cierra
    // y se pide entrar de nuevo, en lugar de mostrar errores raros en cada pantalla.
    if (respuesta.status === 401 && token && !ruta.startsWith('/auth/login')) {
      guardarToken(null)
      window.location.assign('/ingresar')
    }
    throw new ErrorApi(respuesta.status, cuerpo?.error ?? `Error ${respuesta.status}`, cuerpo)
  }
  return cuerpo as T
}

export function apiGet<T>(ruta: string): Promise<T> {
  return apiFetch<T>(ruta)
}

export function apiPost<T>(ruta: string, datos: unknown): Promise<T> {
  return apiFetch<T>(ruta, { method: 'POST', body: JSON.stringify(datos) })
}

export function apiPatch<T>(ruta: string, datos: unknown): Promise<T> {
  return apiFetch<T>(ruta, { method: 'PATCH', body: JSON.stringify(datos) })
}

export function apiPut<T>(ruta: string, datos: unknown): Promise<T> {
  return apiFetch<T>(ruta, { method: 'PUT', body: JSON.stringify(datos) })
}

export function apiDelete<T>(ruta: string): Promise<T> {
  return apiFetch<T>(ruta, { method: 'DELETE' })
}

// Pide un archivo armado por el servidor (por ejemplo, un PDF) y lo baja con el nombre dado.
export async function apiDescargar(ruta: string, datos: unknown, nombre: string) {
  const token = leerToken()
  const respuesta = await fetch(`/api${ruta}`, {
    method: 'POST',
    body: JSON.stringify(datos),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null)
    throw new ErrorApi(respuesta.status, cuerpo?.error ?? `Error ${respuesta.status}`)
  }
  descargarArchivo(await respuesta.blob(), nombre)
}

// Envía archivos (por ejemplo, fotos). No se fija el Content-Type: el navegador lo arma con el FormData.
export async function apiSubir<T>(ruta: string, formulario: FormData): Promise<T> {
  const token = leerToken()
  const respuesta = await fetch(`/api${ruta}`, {
    method: 'POST',
    body: formulario,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const cuerpo = await respuesta.json().catch(() => null)
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, cuerpo?.error ?? `Error ${respuesta.status}`)
  return cuerpo as T
}
