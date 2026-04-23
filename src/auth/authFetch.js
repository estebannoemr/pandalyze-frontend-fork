const TOKEN_KEY = "pandalyze_token";
const GUEST_ID_KEY = "pandalyze_guest_id";

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (_) {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (_) {}
}

export function clearStoredToken() {
  setStoredToken(null);
}

function _randomGuestId() {
  try {
    const bytes = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (_) {
    return (
      "g" +
      Math.random().toString(36).slice(2) +
      Math.random().toString(36).slice(2)
    );
  }
}

export function getOrCreateGuestId() {
  try {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = _randomGuestId();
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  } catch (_) {
    return _randomGuestId();
  }
}

export async function authFetch(url, options = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    if (!headers.has("Authorization")) {
      headers.set("Authorization", "Bearer " + token);
    }
  } else {
    if (!headers.has("X-Guest-Id")) {
      headers.set("X-Guest-Id", getOrCreateGuestId());
    }
  }

  const response = await fetch(url, { ...options, headers });

  if (token && (response.status === 401 || response.status === 422)) {
    clearStoredToken();
    window.dispatchEvent(new CustomEvent("pandalyze:auth-expired"));
  }
  return response;
}
