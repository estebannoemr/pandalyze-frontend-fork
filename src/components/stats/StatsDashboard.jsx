import React, { useCallback, useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import {
  getStatsOverview,
  getStatsTeachers,
  getStatsByClass,
  getStatsTimeDistribution,
  getStatsByChallenge,
} from "./statsApi";
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

  // Etapa 3: agregados extra. Cada uno se carga en paralelo y falla
  // independiente — un error en /by_class no debe bloquear el overview.
  const [byClass, setByClass] = useState([]);
  const [timeDist, setTimeDist] = useState(null);
  const [byChallenge, setByChallenge] = useState([]);

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

  // Cargas extra de etapa 3, en paralelo. Fallan silenciosamente para no
  // tapar el overview principal.
  const loadExtras = useCallback(async () => {
    const args = { teacherId: teacherId || undefined };
    try {
      const r = await getStatsByClass(apiUrl, args);
      setByClass(r.classes || []);
    } catch (_) {
      setByClass([]);
    }
    try {
      const r = await getStatsTimeDistribution(apiUrl, args);
      setTimeDist(r);
    } catch (_) {
      setTimeDist(null);
    }
    try {
      const r = await getStatsByChallenge(apiUrl, args);
      setByChallenge(r.challenges || []);
    } catch (_) {
      setByChallenge([]);
    }
  }, [apiUrl, teacherId]);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  const perStudent = data ? data.per_student || [] : [];
  const byDifficulty = data ? data.by_difficulty || {} : {};
  const timeline = data ? data.timeline || [] : [];
  const summary = data ? data.summary || {} : {};
  const timingAvg = data ? data.timing_avg || {} : {};

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

  // ---- Grafico 5: duracion promedio por dificultad (primer vs ultimo) ----
  // Visible para docente/admin (este dashboard ya esta protegido por rol).
  // Muestra si el tiempo baja con la practica: dos barras por dificultad
  // (minutos promedio del primer desafio aprobado vs del ultimo).
  const timingChart = useMemo(() => {
    const keys = ["basico", "intermedio", "avanzado"];
    const toMinutes = (s) =>
      s == null ? null : Math.round((Number(s) / 60) * 10) / 10;
    const firsts = keys.map((k) => toMinutes(timingAvg[k]?.first_avg_seconds));
    const lasts = keys.map((k) => toMinutes(timingAvg[k]?.last_avg_seconds));
    const labels = keys.map((k) => DIFFICULTY_LABELS[k]);
    return {
      data: [
        {
          type: "bar",
          name: "Primer desafio",
          x: labels,
          y: firsts,
          marker: { color: "#6f42c1" },
          hovertemplate: "%{x} (primero): %{y} min<extra></extra>",
        },
        {
          type: "bar",
          name: "Ultimo desafio",
          x: labels,
          y: lasts,
          marker: { color: "#20c997" },
          hovertemplate: "%{x} (ultimo): %{y} min<extra></extra>",
        },
      ],
      layout: {
        title: {
          text: "Tiempo promedio por dificultad (min)",
          font: { size: 14 },
        },
        barmode: "group",
        margin: { l: 40, r: 20, t: 40, b: 60 },
        yaxis: { title: "Minutos" },
        xaxis: { title: "Dificultad" },
        height: 320,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        showlegend: true,
      },
    };
  }, [timingAvg]);

  // ---- Etapa 3: comparativa entre clases ----
  // Bar chart agrupado: para cada clase, una barra con avg_completed y
  // otra con avg_points (escala secundaria, separada del eje principal).
  const classesChart = useMemo(() => {
    const xs = byClass.map((c) => c.name);
    return {
      data: [
        {
          type: "bar",
          name: "Desafíos completados (prom.)",
          x: xs,
          y: byClass.map((c) => c.avg_completed),
          marker: { color: "#0d6efd" },
          hovertemplate: "%{x}: %{y} desafíos prom.<extra></extra>",
        },
        {
          type: "bar",
          name: "Puntos (prom.)",
          x: xs,
          y: byClass.map((c) => c.avg_points),
          marker: { color: "#ffc107" },
          yaxis: "y2",
          hovertemplate: "%{x}: %{y} pts prom.<extra></extra>",
        },
      ],
      layout: {
        title: { text: "Comparativa entre clases", font: { size: 14 } },
        barmode: "group",
        margin: { l: 50, r: 50, t: 40, b: 80 },
        xaxis: { tickangle: -25, automargin: true },
        yaxis: { title: "Desafíos prom." },
        yaxis2: {
          title: "Puntos prom.",
          overlaying: "y",
          side: "right",
          showgrid: false,
        },
        height: 340,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        showlegend: true,
        legend: { orientation: "h", y: -0.3 },
      },
    };
  }, [byClass]);

  // ---- Etapa 3: distribución de tiempos (apilado por dificultad) ----
  const timeDistChart = useMemo(() => {
    if (!timeDist || !timeDist.distribution) {
      return { data: [], layout: { height: 0 } };
    }
    const buckets = timeDist.buckets || [];
    const series = ["basico", "intermedio", "avanzado"].map((diff) => ({
      type: "bar",
      name: DIFFICULTY_LABELS[diff],
      x: buckets,
      y: buckets.map((b) => {
        const item = (timeDist.distribution[diff] || []).find(
          (i) => i.bucket === b
        );
        return item ? item.count : 0;
      }),
      marker: { color: DIFFICULTY_COLORS[diff] },
      hovertemplate: `${DIFFICULTY_LABELS[diff]} %{x}: %{y}<extra></extra>`,
    }));
    return {
      data: series,
      layout: {
        title: {
          text: "Distribución de tiempos activos por dificultad",
          font: { size: 14 },
        },
        barmode: "stack",
        margin: { l: 40, r: 20, t: 40, b: 60 },
        xaxis: { title: "Tiempo activo" },
        yaxis: { title: "Aprobados", dtick: 1 },
        height: 320,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        showlegend: true,
        legend: { orientation: "h", y: -0.25 },
      },
    };
  }, [timeDist]);

  // ---- Etapa 3: desempeño por desafío (barras horizontales con pass_rate) ----
  const challengePerfChart = useMemo(() => {
    // Ordenamos ascendente por pass_rate: los desafíos más difíciles
    // (pass_rate bajo) aparecen al tope, donde el ojo del docente busca.
    const sorted = [...byChallenge].sort(
      (a, b) => (a.pass_rate || 0) - (b.pass_rate || 0)
    );
    const labels = sorted.map(
      (c) => `[${c.difficulty[0].toUpperCase()}] ${c.title}`
    );
    return {
      data: [
        {
          type: "bar",
          orientation: "h",
          x: sorted.map((c) => Math.round((c.pass_rate || 0) * 100)),
          y: labels,
          marker: {
            color: sorted.map((c) => DIFFICULTY_COLORS[c.difficulty] || "#0d6efd"),
          },
          text: sorted.map(
            (c) =>
              `${c.students_passed}/${c.students_total} • ${c.avg_attempts} int.`
          ),
          textposition: "outside",
          hovertemplate:
            "%{y}<br>Pass rate: %{x}%<br>%{text}<extra></extra>",
        },
      ],
      layout: {
        title: {
          text: "Desempeño por desafío (pass rate %)",
          font: { size: 14 },
        },
        margin: { l: 220, r: 80, t: 40, b: 40 },
        xaxis: { range: [0, 110], title: "% aprobados" },
        height: Math.max(260, sorted.length * 26 + 100),
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
      },
    };
  }, [byChallenge]);

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
              <div className="stats-chart-card">
                <Plot
                  data={timingChart.data}
                  layout={timingChart.layout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: "100%" }}
                  useResizeHandler
                />
              </div>

              {/* Etapa 3 — comparativa entre clases. Sólo se renderiza si hay
                  al menos una clase con alumnos en el scope; si no, queda
                  oculto para no contaminar el grid con un gráfico vacío. */}
              {byClass.length > 0 && (
                <div className="stats-chart-card stats-chart-wide">
                  <Plot
                    data={classesChart.data}
                    layout={classesChart.layout}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: "100%" }}
                    useResizeHandler
                  />
                </div>
              )}

              {/* Etapa 3 — distribución de tiempos por dificultad. */}
              {timeDist && timeDist.total_results_with_timing > 0 && (
                <div className="stats-chart-card">
                  <Plot
                    data={timeDistChart.data}
                    layout={timeDistChart.layout}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: "100%" }}
                    useResizeHandler
                  />
                </div>
              )}

              {/* Etapa 3 — desempeño por desafío. */}
              {byChallenge.length > 0 && (
                <div className="stats-chart-card stats-chart-wide">
                  <Plot
                    data={challengePerfChart.data}
                    layout={challengePerfChart.layout}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: "100%" }}
                    useResizeHandler
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
