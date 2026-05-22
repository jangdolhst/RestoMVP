/**
 * Vercel Edge Function — Geolocalización por IP.
 * Lee los headers automáticos de Vercel (x-vercel-ip-*) y devuelve
 * país, ciudad y coordenadas aproximadas del visitante.
 * 
 * 100% gratis, sin límites, sin API key.
 * Solo funciona en producción (Vercel). En local devuelve nulls.
 */
export const config = { runtime: 'edge' };

export default function handler(request) {
  const country = request.headers.get('x-vercel-ip-country') || null;
  const countryRegion = request.headers.get('x-vercel-ip-country-region') || null;
  const city = request.headers.get('x-vercel-ip-city') || null;
  const latitude = request.headers.get('x-vercel-ip-latitude') || null;
  const longitude = request.headers.get('x-vercel-ip-longitude') || null;

  return new Response(
    JSON.stringify({
      country,
      countryRegion,
      city: city ? decodeURIComponent(city) : null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
