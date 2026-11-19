import { CircleAlert, MessageCircle, Phone } from 'lucide-react'
import { enlaceWhatsapp, useSitio } from '../lib/sitio'

// Señales de que la mascota necesita atención inmediata (orientativas).
const SENALES = [
  'Le cuesta respirar o respira con la boca abierta (en gatos, siempre es una urgencia).',
  'Sangra mucho o tiene una herida profunda.',
  'Tuvo una convulsión o perdió el conocimiento.',
  'Comió veneno, medicamentos de personas, chocolate, uvas o algo tóxico.',
  'La atropellaron o sufrió una caída fuerte, aunque parezca estar bien.',
  'Tiene la panza hinchada y hace arcadas sin poder vomitar.',
  'Hace fuerza para orinar y no le sale nada.',
  'Vomita o tiene diarrea con sangre, o vomita muchas veces seguidas.',
  'Estuvo al sol o en un auto cerrado y jadea mucho, está decaída o babea (golpe de calor).',
]

const MIENTRAS_TANTO = [
  'Mantené la calma y hablale con voz tranquila.',
  'Si sangra, apretá la herida con un paño limpio sin soltar.',
  'Si comió algo tóxico, llevá el envase o una foto de lo que comió.',
  'Para trasladarla, usá una manta o una caja, moviéndola lo menos posible.',
]

const NO_HACER = [
  'No le des remedios de personas: el paracetamol y el ibuprofeno son tóxicos para perros y gatos.',
  'No la hagas vomitar si no te lo indicó un veterinario.',
  'No le des agua ni comida si está inconsciente.',
]

// Empieza con URGENCIA para que se vea entre los demás chats, y deja lugar para lo que la clínica necesita saber.
const MENSAJE_URGENCIA = 'URGENCIA. Hola, mi mascota necesita atención urgente.\n' + 'Nombre y especie: \n' + 'Qué le pasa: \n' + 'Estamos yendo / Estamos en casa: '

export function Urgencias() {
  const { datos } = useSitio()
  const clinica = datos?.clinica
  const telefono = clinica?.telefonoUrgencias ?? clinica?.whatsapp

  return (
    <main>
      <section className="urgencias-portada">
        <div className="contenedor">
          <h1>¿Tu mascota tiene una urgencia?</h1>
          <p>Llamanos antes de venir: así la preparamos para recibirla y te decimos qué hacer en el camino.</p>
          {clinica && telefono && (
            <div className="portada-acciones">
              <a href={`tel:+${telefono}`} className="boton boton-urgencia">
                <Phone size={20} aria-hidden="true" />
                Llamar ahora
              </a>
              <a
                href={enlaceWhatsapp(telefono, MENSAJE_URGENCIA)}
                target="_blank"
                rel="noreferrer"
                className="boton boton-whatsapp"
              >
                <MessageCircle size={20} aria-hidden="true" />
                Escribir por WhatsApp
              </a>
            </div>
          )}
          {clinica?.horarioUrgencias && <p className="urgencias-horario">Urgencias: {clinica.horarioUrgencias}.</p>}
        </div>
      </section>

      <section className="contenedor seccion urgencias-cuerpo">
        <div>
          <h2>Vení de inmediato si tu mascota…</h2>
          <ul className="lista-senales">
            {SENALES.map((s) => (
              <li key={s}>
                <CircleAlert size={20} aria-hidden="true" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="urgencias-consejos">
          <div className="tarjeta">
            <h2>Mientras tanto</h2>
            <ul>
              {MIENTRAS_TANTO.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <div className="tarjeta">
            <h2>Lo que no tenés que hacer</h2>
            <ul>
              {NO_HACER.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <p className="ayuda">
            Esta información es orientativa y no reemplaza la consulta. Ante cualquier duda, llamanos.
          </p>
        </div>
      </section>
    </main>
  )
}
