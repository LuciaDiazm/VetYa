import type { Rol, Usuario } from '../types'

// Qué puede hacer cada perfil del personal. Es la misma tabla que usa el servidor
// (backend/src/lib/permisos.ts): la pantalla solo esconde lo que igual el servidor no dejaría hacer.
export const PERMISOS = {
  'clientes.ver': ['ADMIN', 'VETERINARIO', 'RECEPCION'],
  'clientes.editar': ['ADMIN', 'RECEPCION'],
  'clientes.sanciones': ['ADMIN'],
  'turnos.ver': ['ADMIN', 'VETERINARIO', 'RECEPCION'],
  'turnos.dar': ['ADMIN', 'RECEPCION'],
  'turnos.estado': ['ADMIN', 'VETERINARIO', 'RECEPCION'],
  'clinica.ver': ['ADMIN', 'VETERINARIO'],
  'clinica.escribir': ['ADMIN', 'VETERINARIO'],
  'vacunas.anular': ['ADMIN'],
  'pagos.ver': ['ADMIN', 'VETERINARIO', 'RECEPCION'],
  'pagos.cobrar': ['ADMIN', 'RECEPCION'],
  recordatorios: ['ADMIN', 'VETERINARIO', 'RECEPCION'],
  estadisticas: ['ADMIN'],
  ajustes: ['ADMIN'],
  personal: ['ADMIN'],
  auditoria: ['ADMIN'],
} as const satisfies Record<string, readonly Rol[]>

export type Permiso = keyof typeof PERMISOS

export const PERSONAL: Rol[] = ['ADMIN', 'VETERINARIO', 'RECEPCION']

export const NOMBRE_ROL: Record<Rol, string> = {
  ADMIN: 'Administración',
  VETERINARIO: 'Veterinaria/o',
  RECEPCION: 'Recepción',
  DUENIO: 'Dueño',
}

export function puede(usuario: Pick<Usuario, 'rol'> | null | undefined, permiso: Permiso): boolean {
  return !!usuario && (PERMISOS[permiso] as readonly Rol[]).includes(usuario.rol)
}

// Lo que se cargó hoy (en hora argentina) lo puede corregir quien lo cargó; después, la administración.
export function esDeHoy(fecha: string) {
  const dia = (f: Date) => f.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  return dia(new Date(fecha)) === dia(new Date())
}
