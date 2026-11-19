import { descargarArchivo } from './descargas'

// Funciones para comunicarse con el backend.

// La sesión viaja en una cookie que guarda el navegador y que ningún script puede leer (más segura que
// guardarla en la página). Acá solo se anota si hay alguien adentro, para saber qué hacer si se corta.
let conSesion = false

export function marcarSesion(activa: boolean) {
  conSesion = activa
}

// Antes del 22/11 la sesión se guardaba en el navegador: se borra lo que haya quedado.
try {
  localStorage.removeItem('vetya_token')
} catch {
  // sin almacenamiento, no hay nada que borrar
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
  const respuesta = await fetch(`/api${ruta}`, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...opciones.headers },
  })
  const cuerpo = respuesta.status === 204 ? null : await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    // La sesión ya no vale (se cambió la contraseña, se desactivó la cuenta o venció): se cierra
    // y se pide entrar de nuevo, en lugar de mostrar errores raros en cada pantalla.
    if (respuesta.status === 401 && conSesion && !ruta.startsWith('/auth/')) {
      conSesion = false
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
  const respuesta = await fetch(`/api${ruta}`, {
    method: 'POST',
    body: JSON.stringify(datos),
    headers: { 'Content-Type': 'application/json' },
  })
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null)
    throw new ErrorApi(respuesta.status, cuerpo?.error ?? `Error ${respuesta.status}`)
  }
  descargarArchivo(await respuesta.blob(), nombre)
}

// Envía archivos (por ejemplo, fotos). No se fija el Content-Type: el navegador lo arma con el FormData.
export async function apiSubir<T>(ruta: string, formulario: FormData): Promise<T> {
  const respuesta = await fetch(`/api${ruta}`, { method: 'POST', body: formulario })
  const cuerpo = await respuesta.json().catch(() => null)
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, cuerpo?.error ?? `Error ${respuesta.status}`)
  return cuerpo as T
}
