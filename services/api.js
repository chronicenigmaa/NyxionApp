import AsyncStorage from '@react-native-async-storage/async-storage';

export const EDUOS_BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';
export const LEARN_BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';

const normalizePathVariants = (path) => {
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '') || '/';
  const withTrailingSlash = withoutTrailingSlash === '/' ? '/' : `${withoutTrailingSlash}/`;
  return Array.from(new Set([withoutTrailingSlash, withTrailingSlash]));
};

const buildHeaders = (token, body, extraHeaders = {}) => {
  const headers = { Authorization: token ? `Bearer ${token}` : '', ...extraHeaders };
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData && body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

const parseJsonSafe = async (res) => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

async function requestWithFallbacks({ baseURL, tokenKey, path, method = 'GET', body, headers = {}, fallbackMethods = [] }) {
  const token = await AsyncStorage.getItem(tokenKey);
  const methods = [method, ...fallbackMethods.filter((item) => item !== method)];
  const pathVariants = normalizePathVariants(path);

  let lastError = 'Request failed';
  for (const currentMethod of methods) {
    for (const currentPath of pathVariants) {
      const preparedBody =
        body === undefined
          ? undefined
          : (typeof FormData !== 'undefined' && body instanceof FormData) || typeof body === 'string'
            ? body
            : JSON.stringify(body);

      try {
        const res = await fetch(`${baseURL}${currentPath}`, {
          method: currentMethod,
          headers: buildHeaders(token, preparedBody, headers),
          body: currentMethod === 'GET' ? undefined : preparedBody,
        });
        const data = await parseJsonSafe(res);
        if (res.ok) return data;
        lastError = data?.detail || data?.message || (typeof data === 'string' ? data : `HTTP ${res.status}`);
      } catch (e) {
        lastError = e.message;
      }
    }
  }

  throw new Error(lastError);
}

const createClient = ({ baseURL, tokenKey }) => ({
  get(path, headers) {
    return requestWithFallbacks({ baseURL, tokenKey, path, method: 'GET', headers });
  },
  post(path, body, headers) {
    return requestWithFallbacks({ baseURL, tokenKey, path, method: 'POST', body, headers });
  },
  patch(path, body, headers) {
    return requestWithFallbacks({ baseURL, tokenKey, path, method: 'PATCH', body, headers, fallbackMethods: ['PUT'] });
  },
  put(path, body, headers) {
    return requestWithFallbacks({ baseURL, tokenKey, path, method: 'PUT', body, headers, fallbackMethods: ['PATCH'] });
  },
  delete(path, headers) {
    return requestWithFallbacks({ baseURL, tokenKey, path, method: 'DELETE', headers });
  },
  write(path, options) {
    return requestWithFallbacks({ baseURL, tokenKey, path, ...options });
  },
});

export const eduos = createClient({ baseURL: EDUOS_BASE, tokenKey: 'token' });
export const learn = createClient({ baseURL: LEARN_BASE, tokenKey: 'learn_token' });
