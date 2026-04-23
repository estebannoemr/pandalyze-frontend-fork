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
