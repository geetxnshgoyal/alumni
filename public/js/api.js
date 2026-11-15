// API Client Wrapper with Auth and JWT support

const TOKEN_KEY = 'gec_alumni_jwt';
const USER_KEY = 'gec_alumni_user';

export const auth = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  setSession(token, user) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  getUser() {
    try {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isAuthenticated() {
    return !!localStorage.getItem(TOKEN_KEY);
  },
  isAdmin() {
    const u = this.getUser();
    return u && (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN');
  }
};

export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, query, headers = {}, envelope = false } = options;

  let url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : '/' + path}`;
  if (query) {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, v);
      }
    }
    const qStr = searchParams.toString();
    if (qStr) url += (url.includes('?') ? '&' : '?') + qStr;
  }

  const reqHeaders = {
    'Content-Type': 'application/json',
    ...headers
  };

  const token = auth.getToken();
  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    method,
    headers: reqHeaders
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  let responseData = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    if (response.status === 401 && !path.includes('/auth/login')) {
      auth.clearSession();
      window.location.hash = '#/auth';
    }
    const errMsg = responseData?.error?.message || responseData?.message || responseData?.error || `Request failed with status ${response.status}`;
    const err = new Error(errMsg);
    err.status = response.status;
    err.details = responseData?.error?.details || responseData;
    throw err;
  }

  if (envelope) return responseData; // list endpoints: keep pagination / unread next to data
  return responseData?.data !== undefined ? responseData.data : responseData;
}

export const api = {
  get: (path, query) => apiRequest(path, { method: 'GET', query }),
  getPage: (path, query) => apiRequest(path, { method: 'GET', query, envelope: true }),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body }),
  delete: (path, body) => apiRequest(path, { method: 'DELETE', body })
};
