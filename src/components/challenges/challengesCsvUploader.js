// Utilidad para subir un archivo CSV al backend y registrar su disponibilidad
// en el BlocksService. Es el mismo flujo que usa CsvUploader.jsx pero
// empaquetado en una función pura — pensada para ser llamada desde el
// módulo de desafíos al iniciar un reto.

import BlocksService from "../blocksEditor/services/BlocksService";
import { authFetch } from "../../auth/authFetch";

/**
 * Sube un archivo CSV al endpoint /uploadCsv y lo registra en el BlocksService
 * para que el bloque "read_csv" lo ofrezca como opción.
 *
 * @param {File} file Archivo CSV listo para enviar (File o Blob-with-name).
 * @param {string} apiUrl URL base del backend.
 * @returns {Promise<{csvId: number, columnsNames: string[], fileName: string}>}
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
    } catch (_) {
      // mantenemos el msg por defecto
    }
    throw new Error(msg);
  }

  const jsonData = await response.json();
  if (jsonData?.error) throw new Error(jsonData.error);

  BlocksService.onCsvUpload({
    id: jsonData.csvId,
    filename: jsonData?.fileName,
    columnsNames: jsonData?.columnsNames,
  });

  return {
    csvId: jsonData.csvId,
    columnsNames: jsonData?.columnsNames || [],
    fileName: jsonData?.fileName,
  };
}

/**
 * Envuelve contenido CSV (string) en un File para poder pasarlo a uploadCsvFile.
 *
 * @param {string} csvContent
 * @param {string} filename
 * @returns {File}
 */
export function csvStringToFile(csvContent, filename) {
  const blob = new Blob([csvContent], { type: "text/csv" });
  return new File([blob], filename, { type: "text/csv" });
}
