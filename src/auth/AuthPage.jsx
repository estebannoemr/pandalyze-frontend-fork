import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import "./AuthPage.css";

/**
 * Pantalla de autenticación.
 *
 * Maneja cuatro modos en el mismo componente para no fragmentar la UX:
 *   - "login":    iniciar sesión
 *   - "register": crear cuenta nueva (alumno)
 *   - "forgot":   pedir email de recuperación
 *   - "reset":    setear nueva contraseña con un token recibido por mail
 *
 * Si la URL contiene ?token=..., entramos directamente en modo "reset".
 */
export default function AuthPage({ onCancel }) {
  const {
    login,
    register,
    forgotPassword,
    resetPassword,
    authError,
  } = useAuth();

  // Si llegan con ?token=... en la URL los enviamos directo a modo "reset".
  const initialMode = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("token")) return "reset";
    } catch (_) {}
    return "login";
  })();

  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [classCode, setClassCode] = useState("");
  const [resetToken, setResetToken] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("token") || "";
    } catch (_) {
      return "";
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  useEffect(() => {
    // Limpio el query string después de leer el token para que no quede
    // visible en la barra de direcciones tras el reset.
    if (mode === "reset" && resetToken) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.toString());
      } catch (_) {}
    }
  }, [mode, resetToken]);

  const switchMode = (m) => {
    setMode(m);
    setLocalError("");
    setInfoMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    setInfoMessage("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email.trim().toLowerCase(), password);
      } else if (mode === "register") {
        await register({
          email: email.trim().toLowerCase(),
          password,
          classCode: classCode.trim().toUpperCase(),
        });
      } else if (mode === "forgot") {
        const res = await forgotPassword(email);
        setInfoMessage(
          (res && res.message) ||
            "Si el email existe, te llegar\u00e1 un enlace en breve."
        );
      } else if (mode === "reset") {
        await resetPassword(resetToken.trim(), password);
        setInfoMessage(
          "Contrase\u00f1a actualizada. Ya pod\u00e9s iniciar sesi\u00f3n con la nueva."
        );
        setPassword("");
        setMode("login");
      }
    } catch (err) {
      setLocalError(err.message || "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Pandalyze</h1>
        <p className="auth-subtitle">
          {mode === "forgot"
            ? "Te enviamos un enlace para que puedas restablecer tu contrase\u00f1a."
            : mode === "reset"
            ? "Ingres\u00e1 una nueva contrase\u00f1a para tu cuenta."
            : "Inicia sesion para acceder a los desafios y guardar tu progreso."}
        </p>

        {mode !== "forgot" && mode !== "reset" && (
          <div className="auth-tabs">
            <button
              type="button"
              className={"auth-tab " + (mode === "login" ? "active" : "")}
              onClick={() => switchMode("login")}
            >
              Iniciar sesion
            </button>
            <button
              type="button"
              className={"auth-tab " + (mode === "register" ? "active" : "")}
              onClick={() => switchMode("register")}
            >
              Crear cuenta
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {(mode === "login" ||
            mode === "register" ||
            mode === "forgot") && (
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
          )}

          {mode === "reset" && (
            <label>
              {"Token de recuperaci\u00f3n"}
              <input
                type="text"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder={"Peg\u00e1 el token recibido por mail"}
              />
            </label>
          )}

          {(mode === "login" ||
            mode === "register" ||
            mode === "reset") && (
            <label>
              {mode === "reset" ? "Nueva contrase\u00f1a" : "Contrasena"}
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
              />
            </label>
          )}

          {mode === "register" && (
            <label>
              Codigo de clase <span className="auth-optional">(opcional)</span>
              <input
                type="text"
                maxLength={16}
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                placeholder="Si tu docente te dio uno"
              />
            </label>
          )}

          {(localError || authError) && (
            <div className="auth-error">{localError || authError}</div>
          )}

          {infoMessage && <div className="auth-info">{infoMessage}</div>}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={submitting}
          >
            {submitting
              ? "Procesando..."
              : mode === "login"
              ? "Iniciar sesion"
              : mode === "register"
              ? "Crear cuenta"
              : mode === "forgot"
              ? "Enviarme el enlace"
              : "Cambiar contrase\u00f1a"}
          </button>

          {mode === "login" && (
            <button
              type="button"
              className="auth-link"
              onClick={() => switchMode("forgot")}
            >
              {"\u00bfOlvidaste tu contrase\u00f1a?"}
            </button>
          )}
          {(mode === "forgot" || mode === "reset") && (
            <button
              type="button"
              className="auth-link"
              onClick={() => switchMode("login")}
            >
              {"Volver a iniciar sesi\u00f3n"}
            </button>
          )}

          {typeof onCancel === "function" && (
            <button
              type="button"
              className="btn btn-outline-secondary auth-cancel"
              onClick={onCancel}
            >
              Seguir como invitado
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
