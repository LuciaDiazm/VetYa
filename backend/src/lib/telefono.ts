// Normaliza teléfonos argentinos al formato que usa WhatsApp: 549 + código de área + número.
// Se espera el número sin el 0 del código de área y sin el 15 (ej. "3777 123456").
// Ejemplos:
//   "3777 123456"       -> "5493777123456"
//   "03777-123456"      -> "5493777123456"
//   "+54 9 3777 123456" -> "5493777123456"
export function normalizarTelefono(telefono: string): string {
  let digitos = telefono.replace(/\D/g, "");

  if (digitos.startsWith("0")) digitos = digitos.slice(1);

  if (digitos.length === 10) return `549${digitos}`;
  if (digitos.startsWith("54") && !digitos.startsWith("549") && digitos.length === 12) {
    return `549${digitos.slice(2)}`;
  }
  return digitos;
}
