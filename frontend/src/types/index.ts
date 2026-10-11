// Tipos de los datos que devuelve la API.

export type CategoriaServicio = 'CLINICA' | 'DIAGNOSTICO' | 'CIRUGIA' | 'ESTETICA'

export interface HorarioAtencion {
  id: number
  diaSemana: number
  horaInicio: string
  horaFin: string
}

export interface Clinica {
  id: number
  nombre: string
  direccion: string
  telefono: string
  whatsapp: string
  email: string | null
  instagram: string | null
  latitud: string
  longitud: string
  horarios: HorarioAtencion[]
}

export interface Servicio {
  id: number
  nombre: string
  categoria: CategoriaServicio
  descripcion: string | null
  duracionMin: number
  reservableOnline: boolean
}

export interface PreguntaFrecuente {
  id: number
  pregunta: string
  respuesta: string
}
