// Normaliza teléfonos argentinos al formato que usa WhatsApp: 549 + código de área + número.
// Acepta el número con o sin el 0 del código de área y con o sin el 15.
// Ejemplos:
//   "3777 123456"       -> "5493777123456"
//   "03777-123456"      -> "5493777123456"
//   "+54 9 3777 123456" -> "5493777123456"
//   "03777 15 123456"   -> "5493777123456"
//   "0379 15 4123456"   -> "5493794123456"
//   "011 15 12345678"   -> "5491112345678"
export function normalizarTelefono(telefono: string): string {
  let digitos = telefono.replace(/\D/g, "");

  if (digitos.startsWith("0")) digitos = digitos.slice(1);

  // Mucha gente escribe el 15 después del código de área ("03777-15-123456").
  // Con el 15 quedan 12 dígitos: se busca el 15 después de un código de área de 4, 3 o 2 dígitos
  // (primero 4, que es el de Goya: 3777) y se lo quita.
  if (digitos.length === 12 && !digitos.startsWith("54")) {
    const posicion = [4, 3, 2].find((p) => digitos.slice(p, p + 2) === "15");
    if (posicion !== undefined) digitos = digitos.slice(0, posicion) + digitos.slice(posicion + 2);
  }

  if (digitos.length === 10) return `549${digitos}`;
  if (digitos.startsWith("54") && !digitos.startsWith("549") && digitos.length === 12) {
    return `549${digitos.slice(2)}`;
  }
  return digitos;
}
