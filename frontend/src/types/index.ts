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
  telefonoUrgencias: string | null
  horarioUrgencias: string | null
  horarios: HorarioAtencion[]
}

export interface Servicio {
  id: number
  nombre: string
  categoria: CategoriaServicio
  descripcion: string | null
  duracionMin: number
  reservableOnline: boolean
  fotoUrl: string | null
}

export type Rol = 'DUENIO' | 'VETERINARIO' | 'ADMIN'

export interface Usuario {
  id: number
  nombre: string
  apellido: string
  email: string
  telefono: string | null
  rol: Rol
}

export interface RespuestaSesion {
  token: string
  usuario: Usuario
}

export interface PreguntaFrecuente {
  id: number
  pregunta: string
  respuesta: string
}

export interface MiembroEquipo {
  id: number
  nombre: string
  apellido: string
  matricula: string | null
  especialidad: string | null
  presentacion: string | null
  fotoUrl: string | null
}

export interface Opinion {
  id: number
  autor: string
  mascota: string | null
  texto: string
  puntaje: number
  fecha: string
}

export interface FormaPago {
  id: number
  nombre: string
  detalle: string | null
}

export interface DosisPlan {
  id: number
  tipo: 'VACUNA' | 'DESPARASITACION'
  producto: string
  edadSemanas: number
  nota: string | null
}

export interface PlanSanitario {
  id: number
  nombre: string
  especie: 'PERRO' | 'GATO' | 'OTRO'
  descripcion: string
  fotoUrl: string | null
  dosis: DosisPlan[]
}

export interface Promocion {
  id: number
  titulo: string
  descripcion: string
  vigenteHasta: string
}

// Respuesta de GET /api/publico/sitio
export interface DatosSitio {
  clinica: Clinica
  servicios: Servicio[]
  equipo: MiembroEquipo[]
  opiniones: Opinion[]
  formasPago: FormaPago[]
  planes: PlanSanitario[]
  promociones: Promocion[]
  preguntas: PreguntaFrecuente[]
}
