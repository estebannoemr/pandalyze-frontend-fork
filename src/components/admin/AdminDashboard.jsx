import React, { useEffect, useMemo, useState } from "react";
import {
  adminListUsers,
  adminUpdateUser,
  adminDeleteUser,
} from "../../auth/adminApi";
import AdminClasses from "./AdminClasses";
import "./AdminDashboard.css";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch (_) {
    return iso;
  }
}

const ROLE_LABELS = {
  alumno: "Alumno",
  docente: "Docente",
  admin: "Admin",
};

export default function AdminDashboard({ apiUrl }) {
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [actionError, setActionError] = useState("");
  // Paginación: la API limita per_page a 100; 20 es un sweet spot legible.
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const teachers = useMemo(
    () => users.filter((u) => u.role === "docente"),
    [users]
  );

  const load = async (
    query = q,
    role = roleFilter,
    pageOverride = page,
    perPageOverride = perPage
  ) => {
    setLoading(true);
    setError("");
    try {
      const data = await adminListUsers(apiUrl, {
        q: query,
        role,
        page: pageOverride,
        perPage: perPageOverride,
      });
      setUsers(data.users || []);
      setClasses(data.classes || []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setTotalPages(typeof data.pages === "number" ? data.pages : 1);
    } catch (e) {
      setError(e.message || "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("", "", 1, perPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    load(q, roleFilter, 1, perPage);
  };

  const goToPage = (next) => {
    const clamped = Math.max(1, Math.min(totalPages || 1, next));
    setPage(clamped);
    load(q, roleFilter, clamped, perPage);
  };

  const changePerPage = (newPerPage) => {
    setPerPage(newPerPage);
    setPage(1);
    load(q, roleFilter, 1, newPerPage);
  };

  const handleRoleChange = async (user, newRole) => {
    if (newRole === user.role) return;
    setActionError("");
    try {
      const data = await adminUpdateUser(apiUrl, user.id, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
    } catch (e) {
      setActionError(e.message || "Error al cambiar rol");
    }
  };

  const handleTeacherChange = async (user, newTeacherId) => {
    setActionError("");
    try {
      const data = await adminUpdateUser(apiUrl, user.id, {
        teacher_id: newTeacherId === "" ? null : parseInt(newTeacherId, 10),
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
    } catch (e) {
      setActionError(e.message || "Error al asignar docente");
    }
  };

  const handleClassChange = async (user, newClassId) => {
    setActionError("");
    try {
      const data = await adminUpdateUser(apiUrl, user.id, {
        class_id: newClassId === "" ? null : parseInt(newClassId, 10),
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
    } catch (e) {
      setActionError(e.message || "Error al asignar clase");
    }
  };

  const handleDelete = async (user) => {
    if (
      !window.confirm(
        `¿Eliminar el usuario ${user.email}? Se borrarán sus CSVs y resultados.`
      )
    ) {
      return;
    }
    setActionError("");
    try {
      await adminDeleteUser(apiUrl, user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (e) {
      setActionError(e.message || "Error al eliminar");
    }
  };

  // Helper para obtener los códigos de clase según el rol
  const getClassCodes = (user) => {
    if (user.role === "docente") {
      // Priorizar el array class_codes si existe (nuevas clases)
      if (user.class_codes && user.class_codes.length > 0) {
        return user.class_codes;
      }
      // Fallback al class_code legacy
      return user.class_code ? [user.class_code] : [];
    }
    if (user.role === "alumno" && user.class_id && user.class_name) {
      // Solo mostrar la clase a la que está asociado
      return [{ name: user.class_name, code: user.class_code }];
    }
    return [];
  };

  // Helper para obtener display de docente (muestra su class_code)
  const getTeacherDisplay = (teacher) => {
    if (!teacher) return "—";
    // Mostrar los códigos de clase del docente
    const codes = teacher.class_codes && teacher.class_codes.length > 0 
      ? teacher.class_codes 
      : (teacher.class_code ? [teacher.class_code] : []);
    return codes.length > 0 ? codes.join(", ") : "sin código";
  };

  return (
    <div className="admin-dashboard">
      {/* Sección de clases globales: read-mostly, listado de todas las
          clases del sistema con su docente, código y # de alumnos. */}
      <AdminClasses apiUrl={apiUrl} />

      <div className="admin-header">
        <h2>Gestión de usuarios</h2>
        <form className="admin-search" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            placeholder="Buscar por email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">Todos los roles</option>
            <option value="alumno">Alumno</option>
            <option value="docente">Docente</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="btn btn-primary btn-sm">
            Buscar
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => {
              setQ("");
              setRoleFilter("");
              setPage(1);
              load("", "", 1, perPage);
            }}
          >
            Limpiar
          </button>
        </form>
      </div>

      {loading && <p>Cargando usuarios...</p>}
      {error && <div className="admin-error">{error}</div>}
      {actionError && <div className="admin-error">{actionError}</div>}

      {!loading && !error && (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Rol</th>
                <th>Clases</th>
                <th>Puntos</th>
                <th>Completados</th>
                <th>Último acceso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    {u.role === "admin" ? (
                      <span className="admin-role-badge admin">Admin</span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                      >
                        <option value="alumno">Alumno</option>
                        <option value="docente">Docente</option>
                      </select>
                    )}
                  </td>
                  <td>
                    {u.role === "alumno" && (
                      <div>
                        {u.class_name ? (
                          <div className="admin-class-badges">
                            <span
                              className="admin-class-badge"
                              title={`Clase: ${u.class_name}`}
                            >
                              {u.class_name}
                            </span>
                          </div>
                        ) : (
                          <span className="admin-unassigned">—</span>
                        )}
                        <div style={{ marginTop: "8px", fontSize: "0.9em" }}>
                          <select
                            value={u.class_id || ""}
                            onChange={(e) =>
                              handleClassChange(u, e.target.value)
                            }
                            title="Asignar clase"
                            style={{ width: "100%" }}
                          >
                            <option value="">Sin clase</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} - {c.code} - {c.teacher_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                    {u.role === "docente" && (
                      <div className="admin-class-badges">
                        {u.class_codes && u.class_codes.length > 0 ? (
                          u.class_codes.map((code, idx) => (
                            <span
                              key={idx}
                              className="admin-class-badge"
                              title={`Clase del docente: ${code}`}
                            >
                              {code}
                            </span>
                          ))
                        ) : (
                          <span className="admin-unassigned">—</span>
                        )}
                      </div>
                    )}
                    {u.role === "admin" && (
                      <span className="admin-unassigned">—</span>
                    )}
                  </td>
                  <td>{u.total_points}</td>
                  <td>{u.completed_count}</td>
                  <td>{formatDate(u.last_seen_at)}</td>
                  <td>
                    {u.role !== "admin" && (
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => handleDelete(u)}
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="admin-empty">
                    No hay usuarios para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="admin-pagination">
            <span className="admin-pagination-info">
              {total > 0
                ? `Mostrando ${(page - 1) * perPage + 1}–${Math.min(
                    page * perPage,
                    total
                  )} de ${total}`
                : "Sin resultados"}
            </span>
            <div className="admin-pagination-controls">
              <label>
                Por página:{" "}
                <select
                  value={perPage}
                  onChange={(e) => changePerPage(parseInt(e.target.value, 10))}
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || loading}
              >
                ← Anterior
              </button>
              <span className="admin-pagination-page">
                Página {page} de {Math.max(1, totalPages)}
              </span>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || loading}
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
