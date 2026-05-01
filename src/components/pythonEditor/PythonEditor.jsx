import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import "./styles.css";
import { authFetch } from "../../auth/authFetch";
import BlocksService from "../blocksEditor/services/BlocksService";

const PythonEditor = ({
  frontendCode,
  backendCode,
  setBackendResponse,
  isLoading,
}) => {
  const API_URL = process.env.REACT_APP_API_URL;

  const handleSubmit = () => {
    const pythonCode = backendCode;
    // Adjuntamos los CSVs "inline" (descargados al cliente sin pasar por
    // /uploadCsv, típicamente del flujo de Desafíos) para que el backend
    // pueda resolver read_csv(csv_id) sin tocar la DB. Si no hay ninguno
    // (flujo libre con CSV subido manualmente) la dict queda vacía y el
    // backend cae al lookup tradicional.
    const inlineCsvs = BlocksService.getInlineCsvsForRun
      ? BlocksService.getInlineCsvsForRun()
      : {};
    authFetch(`${API_URL}/runPythonCode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: pythonCode, inline_csvs: inlineCsvs }),
    })
      .then((response) => {
        if (!response.ok) {
          return response.text().then((errorMessage) => {
            throw new Error(errorMessage);
          });
        }
        return response.json();
      })
      .then((jsonData) => {
        let plots = [];
        if (Array.isArray(jsonData.plots)) {
          plots = jsonData.plots.map((plot) => {
            try {
              return JSON.parse(plot);
            } catch (error) {
              console.error("Error parsing plot JSON:", error);
              return null;
            }
          });
        }
        setBackendResponse({
          output: jsonData.output,
          plots: plots,
          type: jsonData.type, 
        });
      })
      .catch((error) => {
        let errorMessage;
        try {
          errorMessage = JSON.parse(error.message);
        } catch (e) {
          errorMessage = {
            personalized_error:
              "Debe esperar a que la aplicación esté lista para usar",
            original_error: error.message,
          };
        }
        console.warn("Error en el codigo:", errorMessage);
        setBackendResponse({
          codeExecutionError: true,
          personalizedError: errorMessage.personalized_error,
          originalError: errorMessage.original_error,
        });
      });
  };

  return (
    <>
      <div className="code-segment">
        <button
          disabled={isLoading}
          className="btn btn-success run-code-button"
          style={{ marginBottom: "16px" }}
          onClick={handleSubmit}
        >
          Ejecutar código
        </button>
        <CodeMirror
          value={frontendCode}
          height="50vh"
          margin-left="0.5vh"
          theme="light"
          readOnly={true}
          extensions={[python({ jsx: true })]}
        />
      </div>
    </>
  );
};

export default PythonEditor;