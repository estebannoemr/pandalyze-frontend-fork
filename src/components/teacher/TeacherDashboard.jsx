import React, { useEffect, useState } from "react";
import { getTeacherStudents } from "../challenges/challengesApi";
import "./TeacherDashboard.css";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch (_) {
    return iso;
  }
}

// Formatea segundos como "Xm Ys" (o "—" si no hay dato). Mantiene legibilidad
// sin exponer precisión innecesaria; el dato es solo para docentes/admin.
function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return "—";
  const total = Math.max(0, Math.floor(Number(seconds)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Devuelve "primero → último" para una dificultad, o "—" si no hay datos.
function renderTimingPair(timing, diff) {
  const t = timing?.[diff];
  if (!t || (t.first == null && t.last == null)) return "—";
  return `${formatDuration(t.first)} → ${formatDuration(t.last)}`;
}

export default function TeacherDashboard({ apiUrl, classCode }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getTeacherStudents(apiUrl);
      setStudents(data.students || []);
    } catch (e) {
      setError(e.message || "Error al cargar alumnos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="teacher-dashboard">
      <div className="teacher-header">
        <h2>Mis alumnos</h2>
        <div className="teacher-class-code-block">
          <span className="teacher-class-code-label">Código de clase:</span>
          <span className="teacher-class-code-value">{classCode || "—"}</span>
        </div>
        <button className="btn btn-outline-primary" onClick={load}>
          Actualizar
        </button>
      </div>

      {loading && <p>Cargando alumnos...</p>}
      {error && <div className="teacher-error">{error}</div>}

      {!loading && !error && students.length === 0 && (
        <p className="teacher-empty">
          Todavía no hay alumnos asociados a tu clase. Compartiles tu código
          de clase para que se registren.
        </p>
      )}

      {!loading && !error && students.length > 0 && (
        <div className="teacher-table-wrapper">
          <table className="teacher-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Nivel</th>
                <th>Puntos</th>
                <th>Desafíos completados</th>
                <th>Último acceso</th>
                <th title="Duración del primer → último desafío básico aprobado">
                  Tiempo básico
                </th>
                <th title="Duración del primer → último desafío intermedio aprobado">
                  Tiempo intermedio
                </th>
                <th title="Duración del primer → último desafío avanzado aprobado">
                  Tiempo avanzado
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.email}</td>
                  <td>
                    <span className="teacher-level-badge">
                      Nivel {s.level} — {s.level_title}
                    </span>
                  </td>
                  <td className="teacher-points">{s.total_points}</td>
                  <td>{s.completed_count}</td>
                  <td>{formatDate(s.last_seen_at)}</td>
                  <td className="teacher-timing">
                    {renderTimingPair(s.timing, "basico")}
                  </td>
                  <td className="teacher-timing">
                    {renderTimingPair(s.timing, "intermedio")}
                  </td>
                  <td className="teacher-timing">
                    {renderTimingPair(s.timing, "avanzado")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
