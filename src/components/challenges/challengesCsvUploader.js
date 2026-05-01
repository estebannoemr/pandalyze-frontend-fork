// Helpers de carga del CSV de un desafío.
//
// La pieza importante es ``loadChallengeCsvClientSide``: descarga el CSV
// del desafío vía ``GET /challenges/<id>/download`` y lo registra en el
// BlocksService como un CSV "inline" (sin pasar por /uploadCsv). El
// dataset queda disponible para el bloque ``read_csv`` y se manda inline
// con cada /runPythonCode, así el servidor nunca persiste copias del
// dataset en la tabla csv_data.
//
// Las funciones ``uploadCsvFile`` y ``csvStringToFile`` quedan exportadas
// por compatibilidad con cualquier consumidor heredado, pero el flujo
// canónico de Desafíos ya no las usa.

import BlocksService from "../blocksEditor/services/BlocksService";
import { authFetch } from "../../auth/authFetch";

/**
 * Construye un csv_id determinístico a partir del filename. Reusa el
 * algoritmo DJB2 que ya existe en BlocksService para que sea compatible
 * con la generación de IDs del flujo libre.
 */
function deterministicCsvId(filename) {
  if (BlocksService.nameToId) {
    return BlocksService.nameToId(filename);
  }
  // Fallback mínimo si en algún refactor desaparece el helper.
  let h = 5381;
  for (let i = 0; i < filename.length; i++) {
    h = (h * 33) ^ filename.charCodeAt(i);
  }
  return String(h >>> 0);
}

/**
 * Parser muy básico de la primera fila del CSV para sacar columnas. No
 * intenta cubrir el caso completo (comillas con comas embebidas, etc.)
 * — para los datasets de los desafíos sirve y evita pulling de papaparse.
 */
function extractColumns(csvContent) {
  const firstLine = (csvContent || "").split(/\r?\n/, 1)[0] || "";
  if (!firstLine) return [];
  return firstLine
    .split(",")
    .map((c) => c.replace(/^"|"$/g, "").trim())
    .filter((c) => c.length > 0);
}

/**
 * Descarga el CSV del desafío y lo registra client-side. Al volver, el
 * bloque ``read_csv`` ya conoce el dataset y los runs subsiguientes lo
 * envían inline al backend. No persiste nada en la DB.
 *
 * @param {string} apiUrl
 * @param {{id:number, csv_filename?:string}} challenge
 * @returns {Promise<{csvId:string, fileName:string, columnsNames:string[]}>}
 */
export async function loadChallengeCsvClientSide(apiUrl, challenge) {
  if (!challenge || challenge.id == null) {
    throw new Error("Desafío inválido para carga client-side.");
  }

  const response = await authFetch(
    `${apiUrl}/challenges/${challenge.id}/download`
  );
  if (!response.ok) {
    let msg = "No pudimos descargar el dataset del desafío.";
    try {
      const body = await response.json();
      if (body?.error) msg = body.error;
    } catch (_) {}
    throw new Error(msg);
  }

  const csvContent = await response.text();
  const filename =
    response.headers.get("X-Challenge-Filename") ||
    challenge.csv_filename ||
    `challenge_${challenge.id}.csv`;
  const columnsNames = extractColumns(csvContent);
  const csvId = deterministicCsvId(filename);

  BlocksService.registerInlineCsv(
    {
      id: csvId,
      filename,
      content: csvContent,
      columnsNames,
    },
    true
  );

  return { csvId, fileName: filename, columnsNames };
}

/**
 * URL absoluta al endpoint de descarga, útil para mostrarla como link
 * "Descargar CSV" en el modal del desafío. authFetch no la cubre porque
 * es un anchor, no un fetch — el header Authorization no viaja, así que
 * el backend la sirve con @jwt_required pero la mayoría de los browsers
 * negocian sin Auth y descargan igual cuando el usuario está logueado vía
 * cookies; si el deploy se mueve a JWT-only, conviene servir la descarga
 * con autenticación opcional.
 */
export function challengeDownloadUrl(apiUrl, challengeId) {
  return `${apiUrl}/challenges/${challengeId}/download`;
}

// ============================================================
// Compatibilidad con el flujo viejo (CSV → /uploadCsv → DB)
// ============================================================

/**
 * @deprecated El flujo de Desafíos ya no sube el CSV al backend. Se mantiene
 * exportada para que cualquier código de terceros que la importe siga
 * compilando, pero no se usa desde App.js a partir de la etapa 2.
 */
export async function uploadCsvFile(file, apiUrl) {
  if (!file) {
    throw new Error("No se proporcionó un archivo CSV para subir.");
  }
  const formData = new FormData();
  formData.append("csv", file);

  const response = await authFetch(`${apiUrl}/uploadCsv`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    let msg = "Error al subir el CSV del desafío";
    try {
      const body = await response.json();
      if (body?.error) msg = body.error;
    } catch (_) {}
    throw new Error(msg);
  }
  const jsonData = await response.json();
  if (jsonData?.error) throw new Error(jsonData.error);

  BlocksService.onCsvUpload(
    {
      id: jsonData.csvId,
      filename: jsonData?.fileName,
      columnsNames: jsonData?.columnsNames,
    },
    true
  );

  return {
    csvId: jsonData.csvId,
    columnsNames: jsonData?.columnsNames || [],
    fileName: jsonData?.fileName,
  };
}

/** @deprecated igual que ``uploadCsvFile``. */
export function csvStringToFile(csvContent, filename) {
  const blob = new Blob([csvContent], { type: "text/csv" });
  return new File([blob], filename, { type: "text/csv" });
}
