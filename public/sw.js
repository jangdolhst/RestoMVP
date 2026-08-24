const CACHE_VERSION = 'jamm-free-pwa-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const APP_SHELL_URLS = [
  '/',
  '/assets/pwa-icon-192.png',
  '/assets/pwa-icon-512.png',
  '/assets/pwa-maskable-192.png',
  '/assets/pwa-maskable-512.png',
];

const NETWORK_ONLY_HOSTS = [
  'supabase.co',
  'nominatim.openstreetmap.org',
];

const STATIC_FILE_PATTERN = /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|woff2?)$/i;

const shouldUseNetworkOnly = (request) => {
  const url = new URL(request.url);

  return (
    request.method !== 'GET' ||
    NETWORK_ONLY_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/api'
  );
};

const hasExpectedStaticContentType = (request, response) => {
  const contentType = response.headers.get('content-type') || '';
  const pathname = new URL(request.url).pathname;

  if (pathname.endsWith('.js')) return contentType.includes('javascript');
  if (pathname.endsWith('.css')) return contentType.includes('text/css');
  if (pathname.endsWith('.webmanifest')) return contentType.includes('manifest') || contentType.includes('json');
  if (/\.(?:png|jpg|jpeg|webp|svg|ico)$/i.test(pathname)) return contentType.startsWith('image/');
  if (/\.(?:woff2?)$/i.test(pathname)) return contentType.includes('font') || contentType.includes('octet-stream');

  return false;
};

const fetchAndCacheStatic = async (request) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);

  if (response.ok && response.type === 'basic' && hasExpectedStaticContentType(request, response)) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }

  return response;
};

const fetchNavigation = async (request) => {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(APP_SHELL_CACHE);
      await cache.put('/', response.clone());
    }
    return response;
  } catch {
    return (await caches.match('/')) || Response.error();
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('jamm-free-pwa-') && !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (shouldUseNetworkOnly(request) || url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetchNavigation(request));
    return;
  }

  if (STATIC_FILE_PATTERN.test(url.pathname) || url.pathname === '/manifest.webmanifest') {
    event.respondWith(fetchAndCacheStatic(request));
  }
});
