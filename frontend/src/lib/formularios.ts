import type { Cliente, EspecieMascota, Mascota } from '../types'
import { formatearTelefono } from './mascotas'

// Valores de los formularios de clientes y mascotas, y cómo se arman a partir de lo guardado.

export interface DatosMascota {
  nombre: string
  especie: EspecieMascota
  sexo: 'MACHO' | 'HEMBRA'
  raza: string
  color: string
  fechaNacimiento: string // "AAAA-MM-DD" o vacío
  castrado: boolean
  observaciones: string
}

export const MASCOTA_VACIA: DatosMascota = {
  nombre: '',
  especie: 'PERRO',
  sexo: 'MACHO',
  raza: '',
  color: '',
  fechaNacimiento: '',
  castrado: false,
  observaciones: '',
}

export function datosDeMascota(m: Mascota): DatosMascota {
  return {
    nombre: m.nombre,
    especie: m.especie,
    sexo: m.sexo,
    raza: m.raza ?? '',
    color: m.color ?? '',
    fechaNacimiento: m.fechaNacimiento ? m.fechaNacimiento.slice(0, 10) : '',
    castrado: m.castrado,
    observaciones: m.observaciones ?? '',
  }
}

export interface DatosCliente {
  nombre: string
  apellido: string
  telefono: string
  dni: string
  email: string
  direccion: string
}

export const CLIENTE_VACIO: DatosCliente = { nombre: '', apellido: '', telefono: '', dni: '', email: '', direccion: '' }

export function datosDeCliente(c: Cliente): DatosCliente {
  return {
    nombre: c.nombre,
    apellido: c.apellido,
    telefono: formatearTelefono(c.telefono),
    dni: c.dni ?? '',
    email: c.email ?? '',
    direccion: c.direccion ?? '',
  }
}
