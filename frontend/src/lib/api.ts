// Funciones para comunicarse con el backend.

export async function apiGet<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(`/api${ruta}`)
  if (!respuesta.ok) {
    throw new Error(`Error ${respuesta.status} al consultar ${ruta}`)
  }
  return respuesta.json() as Promise<T>
}
