import { z } from "zod";

// Símbolos que ningún nombre real lleva (sí se permiten tildes, ñ, espacios, guiones, puntos y apóstrofes: "D'Angelo").
// La web ya muestra todo como texto común; esto evita que se guarden "pruebas" de código como nombre.
const SIMBOLOS_PROHIBIDOS = /[<>{}[\]\\/=;`"$|^~*#@%&+]/;

export const MENSAJE_SIMBOLOS = "No uses símbolos como < > { } en el nombre";

// Nombre de una persona o de una mascota: obligatorio, sin símbolos raros y con un largo razonable.
export function nombre(mensajeVacio: string, max = 60) {
  return z
    .string()
    .trim()
    .min(1, mensajeVacio)
    .max(max, `Usá ${max} letras como máximo`)
    .refine((v) => !SIMBOLOS_PROHIBIDOS.test(v), MENSAJE_SIMBOLOS);
}
