import React, { useEffect, useMemo, useState } from "react";
import { listClasses, deleteClass } from "../teacher/classesApi";
import { adminListUsers } from "../../auth/adminApi";
import "./AdminClasses.css";

// Para filtrar sin que importen mayúsculas ni tildes ("Comisión" == "comision").
const normalizar = (txt) =>
  String(txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

// Vista del admin sobre TODAS las clases del sistema. Read-mostly:
// muestra docente, código, # alumnos, # desafíos seleccionados, fecha de
// creación. Permite borrar la clase (los alumnos quedan sin clase, no
// se borran).
export default function AdminClasses({ apiUrl }) {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("");

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
      setError(e.message || "No se pudieron cargar las comisiones.");
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
        `¿Borrar la comisión "${klass.name}" del docente ${
          teachers[klass.teacher_id] || klass.teacher_id
        }? Los alumnos quedan sin comisión.`
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

  // Comisiones que coinciden con el filtro (nombre, código o email del docente).
  const classesFiltradas = useMemo(() => {
    const q = normalizar(filtro);
    if (!q) return classes;
    return classes.filter(
      (c) =>
        normalizar(c.name).includes(q) ||
        normalizar(c.class_code).includes(q) ||
        normalizar(teachers[c.teacher_id]).includes(q)
    );
  }, [classes, teachers, filtro]);

  return (
    <div className="admin-classes">
      <div className="admin-classes-header">
        <h3>Todas las comisiones del sistema</h3>
        <button className="btn btn-outline-primary btn-sm" onClick={refresh}>
          Actualizar
        </button>
      </div>

      {loading && <p>Cargando comisiones…</p>}
      {error && <div className="admin-classes-error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="admin-classes-summary">
            <span>
              Comisiones: <b>{classes.length}</b>
            </span>
            <span>
              Alumnos asociados: <b>{totalStudents}</b>
            </span>
          </div>

          {classes.length > 1 && (
            <div className="admin-classes-filter">
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Filtrar por nombre, código o docente…"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
              <span className="admin-classes-filter-count">
                Mostrando {classesFiltradas.length} de {classes.length}
              </span>
            </div>
          )}

          {classes.length === 0 ? (
            <p className="admin-classes-empty">
              Todavía no hay comisiones creadas en el sistema.
            </p>
          ) : classesFiltradas.length === 0 ? (
            <p className="admin-classes-empty">
              Ninguna comisión coincide con "{filtro}".
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
                  {classesFiltradas.map((c) => (
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
