import React, { useEffect, useMemo, useState } from "react";
import { listClasses, deleteClass } from "../teacher/classesApi";
import { adminListUsers } from "../../auth/adminApi";
import "./AdminClasses.css";

// Vista del admin sobre TODAS las clases del sistema. Read-mostly:
// muestra docente, código, # alumnos, # desafíos seleccionados, fecha de
// creación. Permite borrar la clase (los alumnos quedan sin clase, no
// se borran).
export default function AdminClasses({ apiUrl }) {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await listClasses(apiUrl);
      setClasses(r.classes || []);
      // Pedimos el listado de docentes (rol=docente, hasta 100) para mapear
      // teacher_id → email. No exponemos PII en gráficos pero acá es admin.
      try {
        const u = await adminListUsers(apiUrl, { role: "docente", perPage: 100 });
        const map = {};
        (u.users || u || []).forEach((t) => {
          map[t.id] = t.email;
        });
        setTeachers(map);
      } catch (_) {}
    } catch (e) {
      setError(e.message || "No se pudieron cargar las clases.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  const handleDelete = async (klass) => {
    if (
      !window.confirm(
        `Borrar la clase "${klass.name}" del docente ${
          teachers[klass.teacher_id] || klass.teacher_id
        }? Los alumnos quedan sin clase.`
      )
    )
      return;
    try {
      await deleteClass(apiUrl, klass.id);
      setClasses((prev) => prev.filter((c) => c.id !== klass.id));
    } catch (e) {
      alert(e.message || "No se pudo borrar.");
    }
  };

  const totalStudents = useMemo(
    () => classes.reduce((acc, c) => acc + (c.students_count || 0), 0),
    [classes]
  );

  return (
    <div className="admin-classes">
      <div className="admin-classes-header">
        <h3>Todas las clases del sistema</h3>
        <button className="btn btn-outline-primary btn-sm" onClick={refresh}>
          Actualizar
        </button>
      </div>

      {loading && <p>Cargando clases…</p>}
      {error && <div className="admin-classes-error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="admin-classes-summary">
            <span>
              Clases: <b>{classes.length}</b>
            </span>
            <span>
              Alumnos asociados: <b>{totalStudents}</b>
            </span>
          </div>

          {classes.length === 0 ? (
            <p className="admin-classes-empty">
              Todavía no hay clases creadas en el sistema.
            </p>
          ) : (
            <div className="admin-classes-table-wrap">
              <table className="admin-classes-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Docente</th>
                    <th>Código</th>
                    <th>Alumnos</th>
                    <th>Desafíos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{teachers[c.teacher_id] || `#${c.teacher_id}`}</td>
                      <td>
                        <code className="admin-classes-code">{c.class_code}</code>
                      </td>
                      <td>{c.students_count ?? 0}</td>
                      <td>{(c.selected_challenge_ids || []).length}</td>
                      <td>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDelete(c)}
                        >
                          Borrar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
