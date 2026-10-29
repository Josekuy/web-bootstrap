/**
 * Devuelve una URL web absoluta sin credenciales o null si no es válida.
 * Los datos pueden contener enlaces pendientes; no generamos destinos vacíos ni ejecutables.
 */
export function obtenerEnlaceWeb(valor) {
  if (typeof valor !== "string" || !valor.trim()) return null;
  try {
    const enlace = new URL(valor);
    const protocoloWeb = enlace.protocol === "https:" || enlace.protocol === "http:";
    return protocoloWeb && !enlace.username && !enlace.password ? enlace.href : null;
  } catch {
    return null;
  }
}
