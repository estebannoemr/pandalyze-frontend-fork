import { authFetch } from "../../auth/authFetch";

export async function getStatsOverview(apiUrl, { teacherId } = {}) {
  const qs = teacherId ? `?teacher_id=${encodeURIComponent(teacherId)}` : "";
  const r = await authFetch(`${apiUrl}/stats/overview${qs}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((data && data.error) || "Error al cargar estadisticas.");
  }
  return data;
}

export async function getStatsTeachers(apiUrl) {
  const r = await authFetch(`${apiUrl}/stats/teachers`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((data && data.error) || "Error al cargar docentes.");
  }
  return data;
}

// Etapa 3 — agregados por clase, distribución de tiempos y desempeño por desafío.

export async function getStatsByClass(apiUrl, { teacherId } = {}) {
  const qs = teacherId ? `?teacher_id=${encodeURIComponent(teacherId)}` : "";
  const r = await authFetch(`${apiUrl}/stats/by_class${qs}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      (data && data.error) || "Error al cargar estadísticas por clase."
    );
  }
  return data;
}

export async function getStatsTimeDistribution(apiUrl, { teacherId } = {}) {
  const qs = teacherId ? `?teacher_id=${encodeURIComponent(teacherId)}` : "";
  const r = await authFetch(`${apiUrl}/stats/time_distribution${qs}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      (data && data.error) || "Error al cargar distribución de tiempos."
    );
  }
  return data;
}

export async function getStatsByChallenge(apiUrl, { teacherId } = {}) {
  const qs = teacherId ? `?teacher_id=${encodeURIComponent(teacherId)}` : "";
  const r = await authFetch(`${apiUrl}/stats/by_challenge${qs}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      (data && data.error) || "Error al cargar desempeño por desafío."
    );
  }
  return data;
}
