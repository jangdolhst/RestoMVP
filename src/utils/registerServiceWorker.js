export const registerServiceWorker = ({ windowRef = globalThis.window, navigatorRef = globalThis.navigator } = {}) => {
  if (!('serviceWorker' in navigatorRef) || !windowRef?.location?.protocol?.startsWith('http')) {
    return;
  }

  const register = () => {
    navigatorRef.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('No se pudo registrar la app instalable', error);
    });
  };

  if (windowRef.document?.readyState === 'complete') {
    register();
    return;
  }

  windowRef.addEventListener?.('load', register, { once: true });
};
