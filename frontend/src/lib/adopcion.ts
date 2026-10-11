import type { AnimalAdopcion, EdadAproximada, EstadoAdopcion, EstadoSolicitud, Tamano, Vivienda } from '../types'

// Textos que se muestran en pantalla para cada valor guardado en la base de datos.

export const EDADES: Record<EdadAproximada, string> = {
  CACHORRO: 'Cachorro',
  JOVEN: 'Joven',
  ADULTO: 'Adulto',
  MAYOR: 'Mayor',
}

export const EDADES_DETALLE: Record<EdadAproximada, string> = {
  CACHORRO: 'Menos de 1 año',
  JOVEN: '1 a 3 años',
  ADULTO: '3 a 8 años',
  MAYOR: 'Más de 8 años',
}

export const TAMANOS: Record<Tamano, string> = {
  CHICO: 'Chico',
  MEDIANO: 'Mediano',
  GRANDE: 'Grande',
}

export const ESTADOS_ADOPCION: Record<EstadoAdopcion, string> = {
  DISPONIBLE: 'Disponible',
  RESERVADO: 'Reservado',
  ADOPTADO: 'Adoptado',
}

export const ESTADOS_SOLICITUD: Record<EstadoSolicitud, string> = {
  NUEVA: 'Nueva',
  CONTACTADA: 'Contactada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'No avanzó',
}

export const VIVIENDAS: Record<Vivienda, string> = {
  CASA_CON_PATIO: 'Casa con patio',
  CASA_SIN_PATIO: 'Casa sin patio',
  DEPARTAMENTO: 'Departamento',
}

// Colores comunes en los animales de la calle; se eligen de una lista para poder filtrar.
export const COLORES = [
  'Negro',
  'Blanco',
  'Marrón',
  'Dorado / caramelo',
  'Gris',
  'Atigrado',
  'Blanco y negro',
  'Blanco y marrón',
  'Tricolor',
  'Crema',
]

// Comportamientos que la clínica tilda al publicar y que la gente usa para filtrar.
export const COMPORTAMIENTOS = [
  { campo: 'tranquilo', texto: 'Tranquilo' },
  { campo: 'jugueton', texto: 'Juguetón' },
  { campo: 'buenoConChicos', texto: 'Bueno con chicos' },
  { campo: 'conviveConPerros', texto: 'Se lleva bien con perros' },
  { campo: 'conviveConGatos', texto: 'Se lleva bien con gatos' },
] as const

export const SALUD = [
  { campo: 'vacunado', texto: 'Vacunado' },
  { campo: 'desparasitado', texto: 'Desparasitado' },
  { campo: 'castrado', texto: 'Castrado' },
] as const

// "Tranquila" o "Tranquilo" según el sexo, para que la ficha se lea natural.
export function enGenero(texto: string, animal: Pick<AnimalAdopcion, 'sexo'>) {
  if (animal.sexo !== 'HEMBRA') return texto
  const cambios: Record<string, string> = {
    Tranquilo: 'Tranquila',
    Juguetón: 'Juguetona',
    'Bueno con chicos': 'Buena con chicos',
    Vacunado: 'Vacunada',
    Desparasitado: 'Desparasitada',
    Castrado: 'Castrada',
    Cachorro: 'Cachorra',
    Adulto: 'Adulta',
    Chico: 'Chica',
    Mediano: 'Mediana',
  }
  return cambios[texto] ?? texto
}

export function fotoPrincipal(animal: Pick<AnimalAdopcion, 'fotos' | 'especie'>) {
  return animal.fotos[0]?.url ?? (animal.especie === 'GATO' ? '/fotos/gatito.jpg' : '/fotos/cachorro.jpg')
}
