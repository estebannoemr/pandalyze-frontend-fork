// Wrapper centralizado para las llamadas al backend del módulo de desafíos.
// Mantiene la UI desacoplada de detalles de fetch y manejo de errores.

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
  const response = await fetch(`${apiUrl}/challenges`);
  return handleResponse(response);
}

export async function getChallengeCsv(apiUrl, challengeId) {
  const response = await fetch(`${apiUrl}/challenges/${challengeId}/csv`);
  return handleResponse(response);
}

export async function validateChallenge(apiUrl, challengeId, output) {
  const response = await fetch(`${apiUrl}/challenges/${challengeId}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ output: output || "" }),
  });
  return handleResponse(response);
}

export async function getChallengeSolution(apiUrl, challengeId) {
  const response = await fetch(`${apiUrl}/challenges/${challengeId}/solution`);
  return handleResponse(response);
}

export async function getGamificationStatus(apiUrl) {
  const response = await fetch(`${apiUrl}/challenges/gamification/status`);
  return handleResponse(response);
}
