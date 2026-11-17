import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'

// Marcador propio con los colores de VetYa (evita el ícono por defecto de Leaflet,
// que no carga bien cuando la app se compila con Vite).
const icono = L.divIcon({
  className: 'mapa-marcador',
  // La onda (b) solo se ve en el inicio, cuando aparece la sección "Dónde estamos" (ver index.css)
  html: '<b class="pin-onda"></b><span></span>',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -34],
})

interface Props {
  latitud: number
  longitud: number
  nombre: string
  direccion: string
}

export function Mapa({ latitud, longitud, nombre, direccion }: Props) {
  return (
    <MapContainer
      center={[latitud, longitud]}
      zoom={16}
      scrollWheelZoom={false}
      className="mapa"
      aria-label={`Mapa con la ubicación de ${nombre}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitud, longitud]} icon={icono}>
        <Popup>
          <strong>{nombre}</strong>
          <br />
          {direccion}
        </Popup>
      </Marker>
    </MapContainer>
  )
}
