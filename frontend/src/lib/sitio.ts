import { useEffect, useState } from 'react'
import type { DatosSitio } from '../types'
import { apiGet } from './api'

// Los datos públicos de la clínica se piden una sola vez y se comparten
// entre la barra, el inicio, el pie y la página de urgencias.
let pedido: Promise<DatosSitio> | null = null

function cargarSitio() {
  pedido ??= apiGet<DatosSitio>('/publico/sitio').catch((error) => {
    pedido = null // si falla, el próximo intento vuelve a pedirlo
    throw error
  })
  return pedido
}

export function useSitio() {
  const [datos, setDatos] = useState<DatosSitio | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let vigente = true
    cargarSitio()
      .then((d) => vigente && setDatos(d))
      .catch(() => vigente && setError(true))
    return () => {
      vigente = false
    }
  }, [])

  return { datos, error }
}

// Enlace de WhatsApp con un mensaje ya escrito.
export function enlaceWhatsapp(numero: string, mensaje: string) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

// Enlace para llamar por teléfono: deja solo los números y les agrega el código de Argentina.
// "3777 000000" → "tel:+543777000000". Si ya viene con 54 adelante, lo respeta.
export function enlaceTelefono(numero: string) {
  const digitos = numero.replace(/\D/g, '').replace(/^0+/, '')
  return `tel:+${digitos.startsWith('54') ? digitos : `54${digitos}`}`
}

export const MENSAJE_TURNO = 'Hola, quiero pedir un turno para mi mascota.'

// Después de cambiar la configuración, la próxima vez se vuelven a pedir los datos públicos.
export function olvidarSitio() {
  pedido = null
}

// La limpieza dental se carga en la categoría Cirugía (lleva anestesia), pero al dueño se le muestra aparte.
export function esLimpiezaDental(servicio: { nombre: string; categoria: string }) {
  return servicio.categoria === 'CIRUGIA' && /limpieza/i.test(servicio.nombre)
}
