import PDFDocument from "pdfkit";
import type { Clinica } from "@prisma/client";
import { AMARILLO, AZUL, dibujarLogo, GRIS } from "./carnet";

// ---------------------------------------------------------------------------
// Recomendaciones para antes y después de una cirugía
// ---------------------------------------------------------------------------

export interface Recomendaciones {
  antes: string[];
  despues: string[];
  avisar: string[];
}

const ANTES_COMUN = [
  "Tiene que venir en ayunas: 8 a 12 horas sin comer.",
  "Agua: se la podés dejar hasta 2 horas antes.",
  "Si es cachorro o está enfermo, preguntanos: el ayuno puede ser distinto.",
  "Contanos si toma algún medicamento.",
  "Traé su libreta o carnet de vacunas.",
];

const CIRUGIA_GENERAL: Recomendaciones = {
  antes: [...ANTES_COMUN, "Traelo con correa o en transportadora."],
  despues: [
    "Dejalo en un lugar tranquilo y abrigado, lejos de escaleras.",
    "Cuando esté bien despierto, ofrecele un poco de agua. La comida, unas horas después y en poca cantidad.",
    "Que use el collar isabelino: no tiene que lamerse la herida.",
    "Mirá la herida todos los días: tiene que estar limpia y seca.",
    "Reposo de 7 a 10 días: sin correr, sin saltar y sin bañarlo.",
    "Dale los medicamentos como te indicó la veterinaria.",
  ],
  avisar: [
    "La herida sangra, tiene pus o se abrió.",
    "Vomita varias veces.",
    "No come después de 24 horas.",
    "Está muy decaído o le cuesta respirar.",
  ],
};

const LIMPIEZA_DENTAL: Recomendaciones = {
  antes: ANTES_COMUN,
  despues: [
    "Por la anestesia, puede estar dormido o torpe el resto del día.",
    "Comida blanda durante 1 o 2 días, en poca cantidad.",
    "Sin huesos ni juguetes duros por unos días.",
    "Dale los medicamentos como te indicó la veterinaria.",
    "Preguntanos cómo cuidarle los dientes en casa.",
  ],
  avisar: [
    "Le sangra mucho la boca.",
    "Vomita varias veces.",
    "No come después de 24 horas.",
    "Está muy decaído o le cuesta respirar.",
  ],
};

// Las cirugías que cargue la clínica más adelante usan las recomendaciones generales.
export function recomendacionesDe(nombreServicio: string): Recomendaciones {
  return /dental/i.test(nombreServicio) ? LIMPIEZA_DENTAL : CIRUGIA_GENERAL;
}

function seccion(doc: PDFKit.PDFDocument, titulo: string, items: string[], color: string, ancho: number) {
  doc.moveDown(0.9);
  doc.font("Helvetica-Bold").fontSize(16).fillColor(color).text(titulo, 48);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(13).fillColor("#1C2537");
  doc.list(items, 56, undefined, { width: ancho - 8, bulletRadius: 2.4, textIndent: 13, paragraphGap: 4 });
}

// Escribe el PDF en el stream de salida (por ejemplo, la respuesta HTTP).
export function escribirRecomendaciones(nombreServicio: string, clinica: Clinica, salida: NodeJS.WritableStream) {
  const r = recomendacionesDe(nombreServicio);
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 44, bottom: 30, left: 48, right: 48 },
    info: { Title: `Recomendaciones: ${nombreServicio}`, Author: clinica.nombre },
  });
  doc.pipe(salida);
  const ancho = doc.page.width - 96;

  dibujarLogo(doc, 48, 44, 44);
  doc.font("Helvetica-Bold").fontSize(18).fillColor(AZUL).text(clinica.nombre, 104, 46);
  doc.font("Helvetica").fontSize(10).fillColor(GRIS).text(`${clinica.direccion}  -  Tel. ${clinica.telefono}`, 104, 70);
  doc.rect(48, 104, ancho, 3).fill(AMARILLO);

  doc.font("Helvetica-Bold").fontSize(21).fillColor(AZUL).text("Recomendaciones para la cirugía", 48, 122);
  doc.font("Helvetica").fontSize(13).fillColor(GRIS).text(nombreServicio, 48);

  seccion(doc, "Antes de la cirugía", r.antes, AZUL, ancho);
  seccion(doc, "Al volver a casa", r.despues, AZUL, ancho);
  seccion(doc, "Avisanos enseguida si...", r.avisar, "#B3261E", ancho);

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(AZUL)
    .text(`¿Tenés dudas? Llamanos al ${clinica.telefono}`, 48, doc.page.height - 84, {
      width: ancho,
      align: "center",
    });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(GRIS)
    .text("Son indicaciones generales. Si la veterinaria te indicó otra cosa, seguí lo que te dijo.", 48, doc.page.height - 66, {
      width: ancho,
      align: "center",
    });

  doc.end();
}
