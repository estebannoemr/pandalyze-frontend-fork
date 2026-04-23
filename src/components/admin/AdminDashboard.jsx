import React, { useEffect, useMemo, useState } from "react";
import {
  adminListUsers,
  adminUpdateUser,
  adminDeleteUser,
} from "../../auth/adminApi";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [actionError, setActionError] = useState("");

  const teachers = useMemo(
    () => users.filter((u) => u.role === "docente"),
    [users]
  );

  const load = async (query = q, role = roleFilter) => {
    setLoading(true);
    setError("");
    try {
      const data = await adminListUsers(apiUrl, { q: query, role });
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message || "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    load(q, roleFilter);
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

  return (
    <div className="admin-dashboard">
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
              load("", "");
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
                <th>Docente / Class code</th>
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
                    {u.role === "docente" && (
                      <code className="admin-class-code">
                        {u.class_code || "—"}
                      </code>
                    )}
                    {u.role === "alumno" && (
                      <select
                        value={u.teacher_id || ""}
                        onChange={(e) =>
                          handleTeacherChange(u, e.target.value)
                        }
                      >
                        <option value="">— sin docente —</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.email}
                          </option>
                        ))}
                      </select>
                    )}
                    {u.role === "admin" && "—"}
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
        </div>
      )}
    </div>
  );
}
