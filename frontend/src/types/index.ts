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

export interface Cirugia extends Servicio {
  queEs: string
  antes: string[]
  despues: string[]
  avisar: string[]
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

// ---------- Clientes y mascotas (panel) ----------

export type EspecieMascota = 'PERRO' | 'GATO' | 'OTRO'

export interface Mascota {
  id: number
  clienteId: number
  nombre: string
  especie: EspecieMascota
  otraEspecie: string | null
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

// Ficha del cliente en el panel: suma la suspensión para turnos web y cómo viene con los turnos.
export interface ClienteDetalle extends Cliente {
  suspendidoHasta: string | null
  suspensionMotivo: string | null
  resumenTurnos: { atendidos: number; ausentes: number; canceladosPorElDueno: number }
  maxTurnosOnline: number | null
  maxTurnosOnlineClinica: number
}

export interface ClienteSuspendido {
  id: number
  nombre: string
  apellido: string
  telefono: string
  suspendidoHasta: string
  suspensionMotivo: string | null
}

export interface ConsultaResumen {
  id: number
  fecha: string
  motivo: string
  pesoKg: string | null
  temperatura: string | null
  diagnostico: string | null
  tratamiento: string | null
  observaciones: string | null
  veterinario: { nombre: string; apellido: string }
  aplicaciones: { id: number; tipo: 'VACUNA' | 'DESPARASITACION'; producto: string }[]
  turno: { servicio: { nombre: string } } | null
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
  observaciones: string | null
  servicio: { nombre: string }
}

export interface FichaMascota extends Mascota {
  cliente: Omit<Cliente, 'mascotas'>
  consultas: ConsultaResumen[]
  aplicaciones: AplicacionSanitaria[]
  turnos: TurnoResumen[]
}

// ---------- Turnos ----------

export type EstadoTurno = 'PENDIENTE' | 'CONFIRMADO' | 'ATENDIDO' | 'AUSENTE' | 'CANCELADO'
export type OrigenTurno = 'ONLINE' | 'TELEFONO' | 'MOSTRADOR'

export interface Turno {
  id: number
  fechaHoraInicio: string
  fechaHoraFin: string
  estado: EstadoTurno
  origen: OrigenTurno
  observaciones: string | null
  canceladoPor?: 'DUENIO' | 'CLINICA' | null
  mascota: Mascota & { cliente: { id: number; nombre: string; apellido: string; telefono: string } }
  servicio: { id: number; nombre: string; duracionMin: number; categoria: CategoriaServicio }
  veterinario: { id: number; nombre: string; apellido: string } | null
  consulta: { id: number } | null
}

// ---------- Recordatorios ----------

interface MascotaConDueno {
  id: number
  nombre: string
  especie: EspecieMascota
  cliente: { id: number; nombre: string; apellido: string; telefono: string }
}

export interface Pendientes {
  turnosManana: { id: number; fechaHoraInicio: string; mascota: MascotaConDueno; servicio: { nombre: string; categoria: CategoriaServicio } }[]
  dosis: (AplicacionSanitaria & { mascotaId: number; mascota: MascotaConDueno; tieneTurno: boolean })[]
  recuperar: { mascota: MascotaConDueno; ultimaVisita: string | null; vencidas: string[]; sinVenir: boolean }[]
}

export interface ResumenRecordatorios {
  turnosManana: number
  dosis: number
  recuperar: number
}

// ---------- Mi cuenta (dueño) ----------

export interface MascotaDelDueno extends Mascota {
  aplicaciones: AplicacionSanitaria[]
  consultas: {
    id: number
    fecha: string
    motivo: string
    tratamiento: string | null
    pesoKg: string | null
    veterinario: { nombre: string; apellido: string }
  }[]
  turnos: { id: number; fechaHoraInicio: string; estado: string; servicio: { nombre: string } }[]
  carnetUrl: string
}

export interface DatosMiCuenta {
  cliente: { nombre: string; apellido: string; telefono: string } | null
  horasCancelacion?: number
  suspendidoHasta?: string | null
  cancelacionesRecientes?: number
  limiteCancelaciones?: number
  diasCancelaciones?: number
  diasSuspension?: number
  mascotas: MascotaDelDueno[]
}

// ---------- Configuración ----------

export type ClinicaConfig = Omit<Clinica, 'horarios'> & {
  horasCancelacion: number
  limiteCancelaciones: number
  diasCancelaciones: number
  diasSuspension: number
  maxTurnosOnline: number
}

export interface ServicioConfig extends Servicio {
  precioReferencia: string | null
  activo: boolean
}

export interface Personal extends Omit<Usuario, 'rol'> {
  rol: 'VETERINARIO' | 'ADMIN'
  activo: boolean
  visibleEnWeb: boolean
  matricula: string | null
  especialidad: string | null
  presentacion: string | null
  fotoUrl: string | null
}

// Turno ya dado que queda afectado por un cambio de horario o un día cerrado.
export interface TurnoAfectado {
  id: number
  fechaHoraInicio: string
  servicio: { nombre: string }
  mascota: { id: number; nombre: string; cliente: { nombre: string; apellido: string; telefono: string } }
}

// ---------- Pagos en la clínica ----------

export type MedioPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO' | 'CREDITO' | 'SIN_CARGO'

interface PersonaCorta {
  id: number
  nombre: string
  apellido: string
}

export interface Pago {
  id: number
  monto: number
  medio: MedioPago
  concepto: string
  nota: string | null
  fecha: string
  anulado: boolean
  anuladoEn: string | null
  motivoAnulacion: string | null
  cliente: (PersonaCorta & { telefono: string }) | null
  turno: { id: number; fechaHoraInicio: string; mascota: { id: number; nombre: string } } | null
  registradoPor: PersonaCorta
  anuladoPor: PersonaCorta | null
}

export interface TotalesPagos {
  total: number
  cantidad: number
  porMedio: Record<MedioPago, number>
}

export interface ListaPagos extends TotalesPagos {
  pagos: Pago[]
}

export interface ResumenCaja extends TotalesPagos {
  porCobrar: number
  montoPorCobrar: number
}

// Turno atendido que todavía no se cobró
export interface TurnoPorCobrar {
  id: number
  fechaHoraInicio: string
  servicio: { id: number; nombre: string; precioReferencia: number | null }
  veterinario: PersonaCorta | null
  mascota: { id: number; nombre: string; cliente: PersonaCorta & { telefono: string } }
}
