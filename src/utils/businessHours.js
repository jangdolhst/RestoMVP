/**
 * Determina si un restaurante está abierto según su configuración de horarios.
 * @param {object|null} businessHours - { open: "09:00", close: "22:00", is_manually_closed: false }
 * @returns {boolean} true si el restaurante está abierto ahora mismo.
 */
export const isRestaurantOpen = (businessHours) => {
  // Sin horario configurado → cerrado
  if (!businessHours) return false;

  // Cierre manual activado → cerrado
  if (businessHours.is_manually_closed) return false;

  const { open, close } = businessHours;
  if (!open || !close) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [openH, openM] = open.split(':').map(Number);
  const [closeH, closeM] = close.split(':').map(Number);

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  // Soporte para horarios que cruzan medianoche (ej: 18:00 - 02:00)
  if (closeMinutes <= openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
};
