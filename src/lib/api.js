const TOKEN_KEY = 'fecc_owner_token_v1';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(url, init = {}) {
  let res;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError('Network error. Check your connection and try again.', 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const fallback =
      res.status === 504
        ? 'The server took too long to respond. Please try again.'
        : res.status >= 500
          ? 'The server ran into a problem. Please try again in a moment.'
          : `Request failed (${res.status})`;
    throw new ApiError(data?.reply || data?.error || fallback, res.status);
  }
  return data;
}

export const ownerToken = {
  get() {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      // ignore
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  },
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

export function fetchDataset() {
  return request('/api/dataset');
}

export function fetchSuggestions() {
  return request('/api/suggestions');
}

/** Reads a File as base64 (no data: prefix). */
export async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function uploadSheetRequest(file, token) {
  const contentBase64 = await fileToBase64(file);
  return request('/api/uploads', {
    method: 'POST',
    headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, contentType: file.type || '', contentBase64 }),
  });
}

export function deleteUploadRequest(id, token) {
  return request(`/api/uploads/${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth(token) });
}

/** Downloads an uploaded file (owner only) and saves it with its original name. */
export async function downloadUpload(upload, token) {
  let res;
  try {
    res = await fetch(`/api/uploads/${encodeURIComponent(upload.id)}/file`, { headers: auth(token) });
  } catch {
    throw new ApiError('Network error. Check your connection and try again.', 0);
  }
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      message = (await res.json()).error || message;
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = upload.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function loginRequest(passcode) {
  return request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode }),
  });
}

export async function verifyTokenRequest(token) {
  try {
    const data = await request('/api/admin/verify', { headers: auth(token) });
    return Boolean(data?.valid);
  } catch {
    return false;
  }
}

export function chatRequest(message, history) {
  return request('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
}

/** Keeps only well-formed "Checked: …" entries from the server (max 6). */
export function cleanSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .filter((x) => x && typeof x.label === 'string' && x.label.trim())
    .slice(0, 6)
    .map((x) => ({ label: x.label.slice(0, 40), detail: typeof x.detail === 'string' ? x.detail.slice(0, 120) : '' }));
}
