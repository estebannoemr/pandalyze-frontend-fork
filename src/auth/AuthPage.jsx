import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import "./AuthPage.css";

export default function AuthPage({ onCancel }) {
  const { login, register, authError } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [classCode, setClassCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email.trim().toLowerCase(), password);
      } else {
        await register({
          email: email.trim().toLowerCase(),
          password,
          classCode: classCode.trim().toUpperCase(),
        });
      }
    } catch (err) {
      setLocalError(err.message || "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (m) => {
    setMode(m);
    setLocalError("");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Pandalyze</h1>
        <p className="auth-subtitle">
          Inicia sesion para acceder a los desafios y guardar tu progreso.
        </p>
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

        <form onSubmit={handleSubmit} className="auth-form">
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
          <label>
            Contrasena
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

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

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={submitting}
          >
            {submitting
              ? "Procesando..."
              : mode === "login"
              ? "Iniciar sesion"
              : "Crear cuenta"}
          </button>

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
