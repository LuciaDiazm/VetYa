import { FileDown, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { enlaceWhatsapp } from '../lib/sitio'

interface Props {
  mascota: { id: number; nombre: string }
  cliente: { id: number; nombre: string; telefono: string }
}

// Ver el carnet de vacunación en PDF o mandárselo al dueño por WhatsApp (con un enlace privado).
export function BotonesCarnet({ mascota, cliente }: Props) {
  const [ocupado, setOcupado] = useState(false)

  async function enlace() {
    const { url } = await apiGet<{ url: string }>(`/mascotas/${mascota.id}/carnet`)
    return `${window.location.origin}${url}`
  }

  // La pestaña se abre antes de esperar al servidor: si no, el navegador la bloquea como ventana emergente.
  async function abrir(armarDestino: (url: string) => string, registrar: boolean) {
    const ventana = window.open('', '_blank')
    setOcupado(true)
    try {
      const url = await enlace()
      const destino = armarDestino(url)
      if (ventana) ventana.location.href = destino
      else window.location.href = destino
      if (registrar) {
        await apiPost('/recordatorios', {
          tipo: 'CARNET',
          clienteId: cliente.id,
          mensaje: `Carnet de ${mascota.nombre}: ${url}`,
        })
      }
    } catch {
      ventana?.close()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="botones-carnet">
      <button type="button" className="boton boton-contorno" disabled={ocupado} onClick={() => abrir((u) => u, false)}>
        <FileDown size={18} aria-hidden="true" /> Ver carnet (PDF)
      </button>
      <button
        type="button"
        className="boton boton-whatsapp"
        disabled={ocupado}
        onClick={() =>
          abrir(
            (u) =>
              enlaceWhatsapp(
                cliente.telefono,
                `Hola ${cliente.nombre}, te mandamos el carnet de vacunación de ${mascota.nombre}. Lo podés ver y descargar acá: ${u}`,
              ),
            true,
          )
        }
      >
        <MessageCircle size={18} aria-hidden="true" /> Enviar carnet por WhatsApp
      </button>
    </div>
  )
}
