// API helpers para el módulo de Clases.
//
// La autorización es transparente: ``authFetch`` agrega el JWT actual.
// El backend valida que el usuario sea docente o admin en cada endpoint.
import { authFetch } from "../../auth/authFetch";

async function handle(response) {
  if (!response.ok) {
    let msg = "Error " + response.status;
    try {
      const body = await response.json();
      if (body && body.error) msg = body.error;
    } catch (_) {}
    throw new Error(msg);
  }
  return response.json();
}

export async function listClasses(apiUrl) {
  const r = await authFetch(`${apiUrl}/classes`);
  return handle(r);
}

export async function createClass(apiUrl, payload) {
  const r = await authFetch(`${apiUrl}/classes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(r);
}

export async function updateClass(apiUrl, classId, patch) {
  const r = await authFetch(`${apiUrl}/classes/${classId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handle(r);
}

export async function deleteClass(apiUrl, classId) {
  const r = await authFetch(`${apiUrl}/classes/${classId}`, {
    method: "DELETE",
  });
  return handle(r);
}

export async function listClassStudents(apiUrl, classId) {
  const r = await authFetch(`${apiUrl}/classes/${classId}/students`);
  return handle(r);
}
