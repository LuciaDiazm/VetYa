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

// ---------- Adopciones ----------

export type EdadAproximada = 'CACHORRO' | 'JOVEN' | 'ADULTO' | 'MAYOR'
export type Tamano = 'CHICO' | 'MEDIANO' | 'GRANDE'
export type EstadoAdopcion = 'DISPONIBLE' | 'RESERVADO' | 'ADOPTADO'
export type EstadoSolicitud = 'NUEVA' | 'CONTACTADA' | 'APROBADA' | 'RECHAZADA'
export type Vivienda = 'CASA_CON_PATIO' | 'CASA_SIN_PATIO' | 'DEPARTAMENTO'

export interface FotoAdopcion {
  id: number
  url: string
  orden: number
}

export interface AnimalAdopcion {
  id: number
  nombre: string
  especie: 'PERRO' | 'GATO'
  sexo: 'MACHO' | 'HEMBRA'
  edad: EdadAproximada
  tamano: Tamano
  color: string
  historia: string | null
  tranquilo: boolean
  jugueton: boolean
  buenoConChicos: boolean
  conviveConPerros: boolean
  conviveConGatos: boolean
  vacunado: boolean
  desparasitado: boolean
  castrado: boolean
  estado: EstadoAdopcion
  publicadoEn: string
  adoptadoEn: string | null
  fotos: FotoAdopcion[]
  _count?: { solicitudes: number }
}

export interface SolicitudAdopcion {
  id: number
  nombre: string
  telefono: string
  vivienda: Vivienda
  otrosAnimales: boolean
  mensaje: string | null
  estado: EstadoSolicitud
  creadaEn: string
  animal: { id: number; nombre: string; especie: 'PERRO' | 'GATO'; estado: EstadoAdopcion; fotos: FotoAdopcion[] }
}

// ---------- Clientes y mascotas (panel) ----------

export type EspecieMascota = 'PERRO' | 'GATO' | 'OTRO'

export interface Mascota {
  id: number
  clienteId: number
  nombre: string
  especie: EspecieMascota
  raza: string | null
  sexo: 'MACHO' | 'HEMBRA'
  fechaNacimiento: string | null
  color: string | null
  castrado: boolean
  observaciones: string | null
  activo: boolean
}

export interface Cliente {
  id: number
  nombre: string
  apellido: string
  dni: string | null
  telefono: string
  email: string | null
  direccion: string | null
  creadoEn: string
  mascotas: Mascota[]
  usuario?: { id: number; email: string } | null
}

export interface ConsultaResumen {
  id: number
  fecha: string
  motivo: string
  pesoKg: string | null
  diagnostico: string | null
  tratamiento: string | null
  veterinario: { nombre: string; apellido: string }
}

export interface AplicacionSanitaria {
  id: number
  tipo: 'VACUNA' | 'DESPARASITACION'
  producto: string
  fechaAplicacion: string
  fechaProximaDosis: string | null
}

export interface TurnoResumen {
  id: number
  fechaHoraInicio: string
  estado: string
  servicio: { nombre: string }
}

export interface FichaMascota extends Mascota {
  cliente: Omit<Cliente, 'mascotas'>
  consultas: ConsultaResumen[]
  aplicaciones: AplicacionSanitaria[]
  turnos: TurnoResumen[]
}
