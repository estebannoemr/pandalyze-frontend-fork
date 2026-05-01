import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import "./ProfileModal.css";

/**
 * Modal de edición de perfil para el usuario autenticado.
 *
 * Permite cambiar la contraseña (validando la actual) y, para alumnos,
 * asociarse a un docente o desasociarse mediante el ``class_code``.
 *
 * No expone el rol ni el email — esas son responsabilidad del admin.
 */
export default function ProfileModal({ onClose }) {
  const { user, updateProfile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [classCode, setClassCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  if (!user) return null;
  const isAlumno = user.role === "alumno";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    const patch = {};
    if (newPassword) {
      patch.new_password = newPassword;
      patch.current_password = currentPassword;
    }
    // Cambio explícito de class_code: solo si el usuario llenó el campo o
    // pidió desasociarse (tipeando "-" o vacío en intencion). Mantenemos
    // el comportamiento simple: si escribió algo, lo mandamos como string
    // (vacío = desasociar).
    if (isAlumno && classCode !== "") {
      patch.class_code = classCode === "-" ? "" : classCode.toUpperCase();
    }
    if (Object.keys(patch).length === 0) {
      setError("No hay cambios para aplicar.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await updateProfile(patch);
      const changed = (res && res.changed) || [];
      const className = (res && res.user && res.user.class_name) || "";
      const teacherName =
        (res && res.user && (res.user.teacher_name || res.user.teacher_email)) || "";
      if (changed.length === 0) {
        setInfo("Sin cambios.");
      } else {
        const messages = changed.map((c) => {
          if (c === "password") return "Actualizaste tu contraseña";
          if ((c === "class_code" || c === "class_id") && patch.class_code === "") {
            return "Te desasociaste de la clase";
          }
          if (c === "class_code" || c === "class_id") {
            if (className && teacherName) {
              return `Cambiaste a la clase ${className} de ${teacherName}`;
            }
            if (className) {
              return `Cambiaste a la clase ${className}`;
            }
            return "Cambiaste de clase";
          }
          if (c === "teacher_id") return "Actualizaste tu docente";
          return c;
        });
        setInfo(messages.join(". ") + ".");
      }
      // Limpio inputs sensibles después de guardar.
      setCurrentPassword("");
      setNewPassword("");
      setClassCode("");
    } catch (err) {
      setError(err.message || "Error inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="profile-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose && onClose();
      }}
    >
      <div className="profile-modal" role="dialog" aria-modal="true">
        <div className="profile-modal-header">
          <h3>Mi perfil</h3>
          <button
            className="profile-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✖
          </button>
        </div>

        <div className="profile-modal-info-row">
          <span className="profile-modal-label">Email</span>
          <span className="profile-modal-value">{user.email}</span>
        </div>
        <div className="profile-modal-info-row">
          <span className="profile-modal-label">Rol</span>
          <span className="profile-modal-value">{user.role}</span>
        </div>
        {isAlumno && (
          <div className="profile-modal-info-row">
            <span className="profile-modal-label">Docente actual</span>
            <span className="profile-modal-value">
              {user.teacher_name || user.teacher_email || "Sin docente"}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="profile-modal-form">
          <fieldset className="profile-modal-fieldset">
            <legend>Cambiar contraseña</legend>
            <label>
              Contraseña actual
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label>
              Nueva contraseña (mín. 6 caracteres)
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          </fieldset>

          {isAlumno && (
            <fieldset className="profile-modal-fieldset">
              <legend>Asociarme a un docente</legend>
              <label>
                Código de clase (escribí "-" para desasociarte)
                <input
                  type="text"
                  maxLength={16}
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  placeholder="6 caracteres alfanuméricos"
                />
              </label>
            </fieldset>
          )}

          {error && <div className="profile-modal-error">{error}</div>}
          {info && <div className="profile-modal-info">{info}</div>}

          <div className="profile-modal-actions">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
            >
              Cerrar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
