import React, { useCallback, useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { getStatsOverview, getStatsTeachers } from "./statsApi";
import "./StatsDashboard.css";

const DIFFICULTY_LABELS = {
  basico: "Basico",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

const DIFFICULTY_COLORS = {
  basico: "#28a745",
  intermedio: "#fd7e14",
  avanzado: "#dc3545",
};

function anonymize(email) {
  if (!email) return "-";
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const name = email.slice(0, at);
  if (name.length <= 2) return name + "***";
  return name.slice(0, 2) + "***";
}

export default function StatsDashboard({ apiUrl, isAdmin }) {
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTeachers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await getStatsTeachers(apiUrl);
      setTeachers(r.teachers || []);
    } catch (e) {
      // No bloqueante; el admin puede seguir viendo el overview global.
    }
  }, [apiUrl, isAdmin]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await getStatsOverview(apiUrl, {
        teacherId: teacherId || undefined,
      });
      setData(r);
    } catch (e) {
      const msg = e.message || "";
      setError(
        msg === "Failed to fetch"
          ? "No hay alumnos registrados."
          : msg || "Error al cargar estadísticas."
      );
    } finally {
      setLoading(false);
    }
  }, [apiUrl, teacherId]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const perStudent = data ? data.per_student || [] : [];
  const byDifficulty = data ? data.by_difficulty || {} : {};
  const timeline = data ? data.timeline || [] : [];
  const summary = data ? data.summary || {} : {};

  // ---- Grafico 1: barras horizontales, desafios completados por alumno ----
  const completedChart = useMemo(() => {
    const sorted = [...perStudent].sort((a, b) => a.completed - b.completed);
    return {
      data: [
        {
          type: "bar",
          orientation: "h",
          x: sorted.map((s) => s.completed),
          y: sorted.map((s) => anonymize(s.email)),
          marker: { color: "#0d6efd" },
          hovertemplate: "%{y}: %{x} desafios<extra></extra>",
        },
      ],
      layout: {
        title: { text: "Desafios completados por alumno", font: { size: 14 } },
        margin: { l: 100, r: 20, t: 40, b: 40 },
        xaxis: { title: "Desafios", dtick: 1 },
        height: Math.max(250, sorted.length * 28 + 100),
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
      },
    };
  }, [perStudent]);

  // ---- Grafico 2: ranking por puntos (barras verticales ordenadas) ----
  const rankingChart = useMemo(() => {
    const sorted = [...perStudent]
      .sort((a, b) => b.points - a.points)
      .slice(0, 15);
    return {
      data: [
        {
          type: "bar",
          x: sorted.map((s) => anonymize(s.email)),
          y: sorted.map((s) => s.points),
          marker: { color: "#ffc107" },
          text: sorted.map((s) => s.points),
          textposition: "outside",
          hovertemplate: "%{x}: %{y} pts<extra></extra>",
        },
      ],
      layout: {
        title: { text: "Ranking por puntos (top 15)", font: { size: 14 } },
        margin: { l: 40, r: 20, t: 40, b: 80 },
        yaxis: { title: "Puntos" },
        xaxis: { tickangle: -40 },
        height: 320,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
      },
    };
  }, [perStudent]);

  // ---- Grafico 3: torta por dificultad ----
  const difficultyChart = useMemo(() => {
    const keys = ["basico", "intermedio", "avanzado"];
    const values = keys.map((k) => byDifficulty[k] || 0);
    return {
      data: [
        {
          type: "pie",
          labels: keys.map((k) => DIFFICULTY_LABELS[k]),
          values: values,
          marker: { colors: keys.map((k) => DIFFICULTY_COLORS[k]) },
          hole: 0.4,
          textinfo: "label+value",
        },
      ],
      layout: {
        title: {
          text: "Distribucion por dificultad",
          font: { size: 14 },
        },
        margin: { l: 20, r: 20, t: 40, b: 20 },
        height: 320,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        showlegend: true,
      },
    };
  }, [byDifficulty]);

  // ---- Grafico 4: evolucion temporal (ultimos 30 dias) ----
  const timelineChart = useMemo(() => {
    return {
      data: [
        {
          type: "scatter",
          mode: "lines+markers",
          x: timeline.map((t) => t.date),
          y: timeline.map((t) => t.passed),
          line: { color: "#17a2b8", width: 2 },
          marker: { size: 6 },
          fill: "tozeroy",
          fillcolor: "rgba(23, 162, 184, 0.15)",
          hovertemplate: "%{x}: %{y} aprobados<extra></extra>",
        },
      ],
      layout: {
        title: {
          text: "Evolucion temporal (ultimos 30 dias)",
          font: { size: 14 },
        },
        margin: { l: 40, r: 20, t: 40, b: 60 },
        yaxis: { title: "Aprobados", dtick: 1 },
        xaxis: { tickangle: -40 },
        height: 320,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
      },
    };
  }, [timeline]);

  const isEmpty = !loading && !error && perStudent.length === 0;

  return (
    <div className="stats-dashboard">
      <div className="stats-header">
        <h2>Estadisticas</h2>
        {isAdmin && (
          <div className="stats-filter">
            <label>Ver alumnos de:</label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              <option value="">Todos los alumnos</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.email}
                  {t.class_code ? ` (${t.class_code})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <button className="btn btn-outline-primary" onClick={loadOverview}>
          Actualizar
        </button>
      </div>

      {loading && <p className="stats-loading">Cargando estadisticas...</p>}
      {error && <div className="stats-error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="stats-summary">
            <div className="stats-summary-card">
              <span className="stats-summary-value">
                {summary.total_students || 0}
              </span>
              <span className="stats-summary-label">Alumnos</span>
            </div>
            <div className="stats-summary-card">
              <span className="stats-summary-value">
                {summary.total_completed || 0}
              </span>
              <span className="stats-summary-label">Desafios aprobados</span>
            </div>
            <div className="stats-summary-card">
              <span className="stats-summary-value">
                {summary.total_points || 0}
              </span>
              <span className="stats-summary-label">Puntos acumulados</span>
            </div>
          </div>

          {isEmpty ? (
            <p className="stats-empty">
              No hay datos de progreso en este scope todavia.
            </p>
          ) : (
            <div className="stats-charts-grid">
              <div className="stats-chart-card">
                <Plot
                  data={completedChart.data}
                  layout={completedChart.layout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: "100%" }}
                  useResizeHandler
                />
              </div>
              <div className="stats-chart-card">
                <Plot
                  data={rankingChart.data}
                  layout={rankingChart.layout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: "100%" }}
                  useResizeHandler
                />
              </div>
              <div className="stats-chart-card">
                <Plot
                  data={difficultyChart.data}
                  layout={difficultyChart.layout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: "100%" }}
                  useResizeHandler
                />
              </div>
              <div className="stats-chart-card">
                <Plot
                  data={timelineChart.data}
                  layout={timelineChart.layout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: "100%" }}
                  useResizeHandler
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
