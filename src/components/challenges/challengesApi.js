// Wrapper centralizado para las llamadas al backend del módulo de desafíos.
// Mantiene la UI desacoplada de detalles de fetch y manejo de errores.
// Todas las llamadas usan authFetch para inyectar el JWT automáticamente.

import { authFetch } from "../../auth/authFetch";

async function handleResponse(response) {
  if (!response.ok) {
    let errorMessage = `Error ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error) errorMessage = body.error;
    } catch (_) {
      // ignoramos, usamos el default
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

export async function getChallenges(apiUrl) {
  const response = await authFetch(`${apiUrl}/challenges`);
  return handleResponse(response);
}

export async function createChallenge(apiUrl, payload) {
  const response = await authFetch(`${apiUrl}/challenges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  return handleResponse(response);
}

export async function getChallengeManage(apiUrl, challengeId) {
  const response = await authFetch(`${apiUrl}/challenges/${challengeId}/manage`);
  return handleResponse(response);
}

export async function updateChallenge(apiUrl, challengeId, payload) {
  const response = await authFetch(`${apiUrl}/challenges/${challengeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  return handleResponse(response);
}

export async function deleteChallenge(apiUrl, challengeId) {
  const response = await authFetch(`${apiUrl}/challenges/${challengeId}`, {
    method: "DELETE",
  });
  return handleResponse(response);
}

export async function getChallengeCsv(apiUrl, challengeId) {
  const response = await authFetch(`${apiUrl}/challenges/${challengeId}/csv`);
  return handleResponse(response);
}

export async function validateChallenge(
  apiUrl,
  challengeId,
  output,
  { startTime = null, activeSeconds = null } = {}
) {
  const body = { output: output || "" };
  if (startTime) body.start_time = startTime;
  if (typeof activeSeconds === "number" && Number.isFinite(activeSeconds)) {
    body.active_seconds = Math.max(0, Math.floor(activeSeconds));
  }
  const response = await authFetch(
    `${apiUrl}/challenges/${challengeId}/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return handleResponse(response);
}

export async function getChallengeSolution(apiUrl, challengeId) {
  const response = await authFetch(
    `${apiUrl}/challenges/${challengeId}/solution`
  );
  return handleResponse(response);
}

export async function getGamificationStatus(apiUrl) {
  const response = await authFetch(
    `${apiUrl}/challenges/gamification/status`
  );
  return handleResponse(response);
}

export async function getLeaderboard(apiUrl) {
  const response = await authFetch(`${apiUrl}/challenges/leaderboard`);
  return handleResponse(response);
}

export async function getTeacherStudents(apiUrl) {
  const response = await authFetch(`${apiUrl}/teacher/students`);
  return handleResponse(response);
}
