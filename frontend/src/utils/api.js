import axios from 'axios';

const BACKEND_URL = (() => {
  // In dev mode (Vite on port 5173), point to local Express backend on 5000
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return 'http://localhost:5000';
  }
  // In production / single-tunnel ngrok mode, frontend & backend share the exact same origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:5000';
})();

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
});

api.interceptors.request.use(
  (config) => {
    // Automatically bypass ngrok interstitial warning page
    config.headers['ngrok-skip-browser-warning'] = 'true';

    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Expired/invalid session: drop the stale token and go to login once,
// instead of leaving every page silently broken. Auth endpoints are exempt
// so a wrong password doesn't redirect.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthCall = url.startsWith('/auth/');
    if (status === 401 && !isAuthCall && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Resolves an image reference into a URL the browser can load.
 * - { id } objects from list APIs -> cached binary endpoint /api/images/:id
 * - { data } objects (edit mode) / data URIs / upload paths -> handled directly
 */
export const getImageUrl = (image) => {
  if (!image) return '';

  // Image object from the API
  if (typeof image === 'object') {
    if (image.data) return getImageUrl(image.data);
    if (image.id) return `${BACKEND_URL}/api/images/${image.id}`;
    return '';
  }

  const data = String(image);

  // Already a full HTTP URL
  if (data.startsWith('http://') || data.startsWith('https://')) return data;

  // Base64 data URI (jpeg, png, webp, etc.)
  if (data.startsWith('data:image/') && data.includes(';base64,')) return data;

  // SVG as utf8 data URI – re-encode as base64 to avoid browser parse issues
  if (data.startsWith('data:image/svg+xml')) {
    try {
      const svgContent = data.replace(/^data:image\/svg\+xml;utf8,/, '');
      const b64 = btoa(unescape(encodeURIComponent(svgContent)));
      return `data:image/svg+xml;base64,${b64}`;
    } catch {
      return data;
    }
  }

  // Relative path saved by multer disk storage
  if (data.startsWith('/uploads/') || data.startsWith('/uploads\\')) {
    return `${BACKEND_URL}${data}`;
  }
  if (data.startsWith('uploads/') || data.startsWith('uploads\\')) {
    return `${BACKEND_URL}/${data}`;
  }

  // Bare numeric id from the API
  if (/^\d+$/.test(data)) return `${BACKEND_URL}/api/images/${data}`;

  return data;
};

export default api;
