// Helpers para la API admin.
import { authFetch } from "./authFetch";

async function handleResponse(response) {
  if (!response.ok) {
    let errorMessage = "Error " + response.status;
    try {
      const body = await response.json();
      if (body && body.error) errorMessage = body.error;
    } catch (_) {}
    throw new Error(errorMessage);
  }
  return response.json();
}

export async function adminListUsers(
  apiUrl,
  { q = "", role = "", page = 1, perPage = 20 } = {}
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (role) params.set("role", role);
  if (page) params.set("page", String(page));
  if (perPage) params.set("per_page", String(perPage));
  const url = `${apiUrl}/admin/users?${params.toString()}`;
  const response = await authFetch(url);
  return handleResponse(response);
}

export async function adminUpdateUser(apiUrl, userId, patch) {
  const response = await authFetch(`${apiUrl}/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handleResponse(response);
}

export async function adminDeleteUser(apiUrl, userId) {
  const response = await authFetch(`${apiUrl}/admin/users/${userId}`, {
    method: "DELETE",
  });
  return handleResponse(response);
}
