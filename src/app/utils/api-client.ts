export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '') ??
  'http://localhost:8080';

const buildHeaders = (headers?: HeadersInit) => {
  const nextHeaders = new Headers(headers);

  if (!nextHeaders.has('Accept')) {
    nextHeaders.set('Accept', 'application/json');
  }

  return nextHeaders;
};

export const buildApiUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export const apiFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof input === 'string' ? buildApiUrl(input) : input;

  return fetch(url, {
    ...init,
    credentials: init.credentials ?? 'include',
    headers: buildHeaders(init.headers),
  });
};
