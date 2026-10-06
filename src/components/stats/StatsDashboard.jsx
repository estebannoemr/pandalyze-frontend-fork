import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  basico: "Básico",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

const DIFFICULTY_COLORS = {
  basico: "#28a745",
  intermedio: "#fd7e14",
  avanzado: "#dc3545",
};

// Config de Plotly compartida por todos los gráficos. Se define una sola vez
// (fuera del componente) para que su identidad no cambie en cada render: si
// cambiara, react-plotly.js volvería a dibujar todos los gráficos cada vez.
const PLOT_CONFIG = { displayModeBar: false, responsive: true };

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

  // Agregados extra. Cada uno se carga en paralelo y falla
  // independiente -> un error en /by_class no debe bloquear el overview.
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

  // Carga única: el resumen y los agregados extra se piden juntos y el
  // tablero se dibuja una sola vez, cuando ya llegó todo. Antes se cargaban
  // en dos tandas (primero el resumen, después los extra) y los gráficos se
  // montaban de a partes; "Actualizar" solo recargaba el resumen.
  // Cada pedido falla de forma independiente: un error en un agregado extra
  // no tapa el resumen principal.
  const requestIdRef = useRef(0);

  const loadAll = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    const args = { teacherId: teacherId || undefined };
    const [overviewRes, byClassRes, timeDistRes, byChallengeRes] =
      await Promise.allSettled([
        getStatsOverview(apiUrl, args),
        getStatsByClass(apiUrl, args),
        getStatsTimeDistribution(apiUrl, args),
        getStatsByChallenge(apiUrl, args),
      ]);
    // Si mientras tanto se pidió otra carga (cambio de filtro), se descarta
    // esta respuesta para no pisar datos más nuevos con otros viejos.
    if (requestId !== requestIdRef.current) return;

    if (overviewRes.status === "fulfilled") {
      setData(overviewRes.value);
    } else {
      const msg = (overviewRes.reason && overviewRes.reason.message) || "";
      setError(
        msg === "Failed to fetch"
          ? "No se pudo conectar con el servidor. Probá de nuevo en unos segundos."
          : msg || "Error al cargar estadísticas."
      );
    }
    setByClass(
      byClassRes.status === "fulfilled" ? byClassRes.value.classes || [] : []
    );
    setTimeDist(timeDistRes.status === "fulfilled" ? timeDistRes.value : null);
    setByChallenge(
      byChallengeRes.status === "fulfilled"
        ? byChallengeRes.value.challenges || []
        : []
    );
    setLoading(false);
  }, [apiUrl, teacherId]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const perStudent = useMemo(() => (data && data.per_student) || [], [data]);
  const byDifficulty = useMemo(() => (data && data.by_difficulty) || {}, [data]);
  const timeline = useMemo(() => (data && data.timeline) || [], [data]);
  const timingAvg = useMemo(() => (data && data.timing_avg) || {}, [data]);
  const summary = (data && data.summary) || {};

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
          hovertemplate: "%{y}: %{x} desafíos<extra></extra>",
        },
      ],
      layout: {
        title: { text: "Desafíos completados por alumno", font: { size: 14 } },
        margin: { l: 100, r: 20, t: 40, b: 40 },
        xaxis: { title: "Desafíos", dtick: 1 },
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
          text: "Distribución por dificultad",
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
          text: "Evolución temporal (últimos 30 días)",
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
          name: "Primer desafío",
          x: labels,
          y: firsts,
          marker: { color: "#6f42c1" },
          hovertemplate: "%{x} (primero): %{y} min<extra></extra>",
        },
        {
          type: "bar",
          name: "Último desafío",
          x: labels,
          y: lasts,
          marker: { color: "#20c997" },
          hovertemplate: "%{x} (último): %{y} min<extra></extra>",
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

  // ---- Comparativa entre clases ----
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
        title: { text: "Comparativa entre comisiones", font: { size: 14 } },
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

  // ---- Distribución de tiempos (apilado por dificultad) ----
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

  // ---- Desempeño por desafío (barras horizontales con pass_rate) ----
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
            "%{y}<br>Aprobación: %{x}%<br>%{text}<extra></extra>",
        },
      ],
      layout: {
        title: {
          text: "Desempeño por desafío (% de intentos aprobados)",
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
        <h2>Estadísticas</h2>
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
                </option>
              ))}
            </select>
          </div>
        )}
        <button className="btn btn-outline-primary" onClick={loadAll}>
          Actualizar
        </button>
      </div>

      {loading && <p className="stats-loading">Cargando estadísticas...</p>}
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
              <span className="stats-summary-label">Desafíos aprobados</span>
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
              Todavía no hay datos de progreso para mostrar.
            </p>
          ) : (
            <div className="stats-charts-grid">
              <div className="stats-chart-card">
                <Plot
                  data={completedChart.data}
                  layout={completedChart.layout}
                  config={PLOT_CONFIG}
                  style={{ width: "100%" }}
                  useResizeHandler
                />
              </div>
              <div className="stats-chart-card">
                <Plot
                  data={rankingChart.data}
                  layout={rankingChart.layout}
                  config={PLOT_CONFIG}
                  style={{ width: "100%" }}
                  useResizeHandler
                />
              </div>
              <div className="stats-chart-card">
                <Plot
                  data={difficultyChart.data}
                  layout={difficultyChart.layout}
                  config={PLOT_CONFIG}
                  style={{ width: "100%" }}
                  useResizeHandler
                />
              </div>
              <div className="stats-chart-card">
                <Plot
                  data={timelineChart.data}
                  layout={timelineChart.layout}
                  config={PLOT_CONFIG}
                  style={{ width: "100%" }}
                  useResizeHandler
                />
              </div>
              <div className="stats-chart-card">
                <Plot
                  data={timingChart.data}
                  layout={timingChart.layout}
                  config={PLOT_CONFIG}
                  style={{ width: "100%" }}
                  useResizeHandler
                />
              </div>

              {/* Comparativa entre clases. Sólo se renderiza si hay
                  al menos una clase con alumnos en el scope; si no, queda
                  oculto para no contaminar el grid con un gráfico vacío. */}
              {byClass.length > 0 && (
                <div className="stats-chart-card stats-chart-wide">
                  <Plot
                    data={classesChart.data}
                    layout={classesChart.layout}
                    config={PLOT_CONFIG}
                    style={{ width: "100%" }}
                    useResizeHandler
                  />
                </div>
              )}

              {/* Distribución de tiempos por dificultad. */}
              {timeDist && timeDist.total_results_with_timing > 0 && (
                <div className="stats-chart-card">
                  <Plot
                    data={timeDistChart.data}
                    layout={timeDistChart.layout}
                    config={PLOT_CONFIG}
                    style={{ width: "100%" }}
                    useResizeHandler
                  />
                </div>
              )}

              {/* Desempeño por desafío. */}
              {byChallenge.length > 0 && (
                <div className="stats-chart-card stats-chart-wide">
                  <Plot
                    data={challengePerfChart.data}
                    layout={challengePerfChart.layout}
                    config={PLOT_CONFIG}
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
