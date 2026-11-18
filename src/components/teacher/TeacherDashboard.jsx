import React, { useEffect, useMemo, useState } from "react";
import { getTeacherStudents } from "../challenges/challengesApi";
import MyClasses from "./MyClasses";
import "./TeacherDashboard.css";

function formatDate(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch (_) {
    return iso;
  }
}

// Formatea segundos como "Xm Ys" (o "-" si no hay dato). Mantiene legibilidad
// sin exponer precisión innecesaria; el dato es solo para docentes/admin.
function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return "-";
  const total = Math.max(0, Math.floor(Number(seconds)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Devuelve "primero → último" para una dificultad, o "-" si no hay datos.
function renderTimingPair(timing, diff) {
  const t = timing?.[diff];
  if (!t || (t.first == null && t.last == null)) return "-";
  return `${formatDuration(t.first)} → ${formatDuration(t.last)}`;
}

export default function TeacherDashboard({ apiUrl }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Filtro por comisión ("todas", "none" = sin comisión o el id de la comisión)
  // y orden por una columna numérica: campo null = orden original,
  // "puntos" | "completados"; dir "desc" = mayor a menor, "asc" = menor a mayor.
  const [comisionFiltro, setComisionFiltro] = useState("todas");
  const [orden, setOrden] = useState({ campo: null, dir: "desc" });

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

  // Comisiones que aparecen entre los alumnos, para armar el desplegable.
  const comisiones = useMemo(() => {
    const porId = new Map();
    students.forEach((s) => {
      if (s.class_id && !porId.has(s.class_id)) {
        porId.set(s.class_id, s.class_name || `Comisión ${s.class_id}`);
      }
    });
    return [...porId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [students]);
  const haySinComision = students.some((s) => !s.class_id);

  // Primero se filtra por comisión y después se ordena (los dos funcionan a
  // la vez). Con el mismo valor se desempata por email.
  const alumnosVisibles = useMemo(() => {
    let lista = students;
    if (comisionFiltro === "none") {
      lista = lista.filter((s) => !s.class_id);
    } else if (comisionFiltro !== "todas") {
      lista = lista.filter((s) => String(s.class_id) === comisionFiltro);
    }
    if (orden.campo) {
      const signo = orden.dir === "asc" ? 1 : -1;
      const valor = (s) =>
        (orden.campo === "puntos" ? s.total_points : s.completed_count) || 0;
      lista = [...lista].sort(
        (a, b) =>
          signo * (valor(a) - valor(b)) ||
          String(a.email).localeCompare(String(b.email))
      );
    }
    return lista;
  }, [students, comisionFiltro, orden]);

  // Al tocar un encabezado: mayor a menor -> menor a mayor -> orden original.
  // Si se toca otra columna, arranca de mayor a menor.
  const alternarOrden = (campo) =>
    setOrden((o) => {
      if (o.campo !== campo) return { campo, dir: "desc" };
      if (o.dir === "desc") return { campo, dir: "asc" };
      return { campo: null, dir: "desc" };
    });

  const flechaOrden = (campo) =>
    orden.campo !== campo ? "↕" : orden.dir === "desc" ? "▼" : "▲";

  const ariaSortDe = (campo) =>
    orden.campo !== campo
      ? "none"
      : orden.dir === "desc"
      ? "descending"
      : "ascending";

  return (
    <div className="teacher-dashboard">
      {/* Sección de gestión de comisiones. El código de inscripción de cada
          comisión se muestra en su tarjeta. */}
      <MyClasses apiUrl={apiUrl} />

      <div className="teacher-header">
        <h2>Mis alumnos</h2>
        <button className="btn btn-outline-primary" onClick={load}>
          Actualizar
        </button>
      </div>

      {loading && <p>Cargando alumnos...</p>}
      {error && <div className="teacher-error">{error}</div>}

      {!loading && !error && students.length === 0 && (
        <p className="teacher-empty">
          Todavía no hay alumnos en tus comisiones. Compartiles el código
          de la comisión para que se sumen al registrarse o desde "Mi perfil".
        </p>
      )}

      {!loading && !error && students.length > 0 && (
        <div className="teacher-filters">
          <label htmlFor="teacher-filtro-comision">Comisión:</label>
          <select
            id="teacher-filtro-comision"
            className="form-select form-select-sm"
            value={comisionFiltro}
            onChange={(e) => setComisionFiltro(e.target.value)}
          >
            <option value="todas">Todas</option>
            {comisiones.map(([id, nombre]) => (
              <option key={id} value={String(id)}>
                {nombre}
              </option>
            ))}
            {haySinComision && <option value="none">Sin comisión</option>}
          </select>
          <span className="teacher-filters-count">
            Mostrando {alumnosVisibles.length} de {students.length}
          </span>
        </div>
      )}

      {!loading && !error && students.length > 0 && (
        <div className="teacher-table-wrapper">
          <table className="teacher-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Comisión</th>
                <th>Nivel</th>
                {[
                  ["puntos", "Puntos"],
                  ["completados", "Desafíos completados"],
                ].map(([campo, titulo]) => (
                  <th
                    key={campo}
                    className="teacher-th-sortable"
                    onClick={() => alternarOrden(campo)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        alternarOrden(campo);
                      }
                    }}
                    tabIndex={0}
                    title={`Ordenar por ${titulo.toLowerCase()}`}
                    aria-sort={ariaSortDe(campo)}
                  >
                    {titulo} {flechaOrden(campo)}
                  </th>
                ))}
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
              {alumnosVisibles.map((s) => (
                <tr key={s.id}>
                  <td>{s.email}</td>
                  <td>{s.class_name || "Sin comisión"}</td>
                  <td>
                    <span className="teacher-level-badge">
                      Nivel {s.level} - {s.level_title}
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
