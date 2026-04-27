import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  authFetch,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "./authFetch";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const API_URL = process.env.REACT_APP_API_URL;

  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(Boolean(getStoredToken()));
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!token) {
      setBootstrapping(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await authFetch(API_URL + "/auth/me");
        if (!r.ok) throw new Error("Sesion invalida");
        const data = await r.json();
        if (!cancelled) setUser(data.user);
      } catch (_) {
        if (!cancelled) {
          clearStoredToken();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, API_URL]);

  useEffect(() => {
    const onExpired = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener("pandalyze:auth-expired", onExpired);
    return () =>
      window.removeEventListener("pandalyze:auth-expired", onExpired);
  }, []);

  const login = useCallback(
    async (email, password) => {
      setAuthError("");
      const r = await fetch(API_URL + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = (data && data.error) || "Error al iniciar sesion.";
        setAuthError(msg);
        throw new Error(msg);
      }
      setStoredToken(data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      return data.user;
    },
    [API_URL]
  );

  const register = useCallback(
    async ({ email, password, classCode }) => {
      setAuthError("");
      const body = { email, password };
      if (classCode) body.class_code = classCode;
      const r = await fetch(API_URL + "/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = (data && data.error) || "Error al registrarse.";
        setAuthError(msg);
        throw new Error(msg);
      }
      setStoredToken(data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      return data.user;
    },
    [API_URL]
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setAuthError("");
  }, []);

  // ---------------- Recuperación de contraseña ----------------
  // Estos métodos no requieren JWT y por eso usan fetch directo.
  // Devuelven el body del backend, o lanzan Error con el mensaje.
  const forgotPassword = useCallback(
    async (email) => {
      const r = await fetch(API_URL + "/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: (email || "").trim().toLowerCase() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error((data && data.error) || "Error solicitando reset.");
      }
      return data;
    },
    [API_URL]
  );

  const resetPassword = useCallback(
    async (token, newPassword) => {
      const r = await fetch(API_URL + "/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error((data && data.error) || "Error reseteando contraseña.");
      }
      return data;
    },
    [API_URL]
  );

  // ---------------- Edición de perfil ----------------
  // Requiere JWT, usa authFetch. Acepta un patch con cualquier subset de
  // {current_password, new_password, class_code} y refresca el user local
  // con la respuesta del backend.
  const updateProfile = useCallback(
    async (patch) => {
      const r = await authFetch(API_URL + "/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch || {}),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error((data && data.error) || "Error actualizando perfil.");
      }
      if (data && data.user) setUser(data.user);
      return data;
    },
    [API_URL]
  );

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      bootstrapping,
      authError,
      login,
      register,
      logout,
      forgotPassword,
      resetPassword,
      updateProfile,
    }),
    [
      user,
      token,
      bootstrapping,
      authError,
      login,
      register,
      logout,
      forgotPassword,
      resetPassword,
      updateProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
