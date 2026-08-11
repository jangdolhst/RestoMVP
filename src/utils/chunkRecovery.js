export const CHUNK_RECOVERY_KEY = 'jf_chunk_recovery_last_url';

const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  /loading chunk .+ failed/i,
  /err_cache_read_failure/i,
  /unable to preload/i,
];

const getMessageParts = (error) => {
  if (!error) return [];
  if (typeof error === 'string') return [error];

  return [
    error.message,
    error.reason?.message,
    error.error?.message,
    error.payload?.message,
    error.target?.src,
    error.target?.href,
  ].filter(Boolean);
};

export const isChunkLoadError = (error) => {
  const text = getMessageParts(error).join(' ');

  if (CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  return /\/assets\/.+\.(js|css)(\?|$)/i.test(text);
};

export const recoverFromChunkLoadError = (error, { windowRef = globalThis.window } = {}) => {
  if (!isChunkLoadError(error) || !windowRef?.location?.reload) {
    return false;
  }

  const href = windowRef.location.href || 'unknown-url';
  const storage = windowRef.sessionStorage;

  try {
    if (storage?.getItem(CHUNK_RECOVERY_KEY) === href) {
      return false;
    }
    storage?.setItem(CHUNK_RECOVERY_KEY, href);
  } catch {
    // Storage can be unavailable in private modes; reload still gives the user the new bundle.
  }

  windowRef.location.reload();
  return true;
};

export const clearChunkRecoveryFlag = ({ windowRef = globalThis.window, delayMs = 5000 } = {}) => {
  if (!windowRef?.setTimeout || !windowRef?.sessionStorage) {
    return;
  }

  windowRef.setTimeout(() => {
    try {
      windowRef.sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
    } catch {
      // Nothing actionable; the flag is only a loop guard.
    }
  }, delayMs);
};

export const installChunkRecovery = ({ windowRef = globalThis.window } = {}) => {
  if (!windowRef?.addEventListener) {
    return () => {};
  }

  const onPreloadError = (event) => {
    const error = event?.payload ?? event;
    if (!isChunkLoadError(error)) return;

    event?.preventDefault?.();
    recoverFromChunkLoadError(error, { windowRef });
  };

  const onUnhandledRejection = (event) => {
    const error = event?.reason ?? event;
    if (!isChunkLoadError(error)) return;

    event?.preventDefault?.();
    recoverFromChunkLoadError(error, { windowRef });
  };

  const onResourceError = (event) => {
    const target = event?.target;
    const source = target?.src || target?.href;
    if (!source || !isChunkLoadError({ message: source })) return;

    recoverFromChunkLoadError({ message: source }, { windowRef });
  };

  windowRef.addEventListener('vite:preloadError', onPreloadError);
  windowRef.addEventListener('unhandledrejection', onUnhandledRejection);
  windowRef.addEventListener('error', onResourceError, true);
  clearChunkRecoveryFlag({ windowRef });

  return () => {
    windowRef.removeEventListener?.('vite:preloadError', onPreloadError);
    windowRef.removeEventListener?.('unhandledrejection', onUnhandledRejection);
    windowRef.removeEventListener?.('error', onResourceError, true);
  };
};
