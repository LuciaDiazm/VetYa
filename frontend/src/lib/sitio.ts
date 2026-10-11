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

export const MENSAJE_TURNO = 'Hola, quiero pedir un turno para mi mascota.'
