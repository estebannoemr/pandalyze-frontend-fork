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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
