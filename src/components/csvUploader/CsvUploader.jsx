import React, { useEffect, useState } from "react";
import "./CsvUploaderStyles.css";
import BlocksService from "../blocksEditor/services/BlocksService";
import defaultCsv from "./default.csv";
import ErrorAlert from "../alerts/errorAlert/ErrorAlert";
import SuccessAlert from "../alerts/successAlert/SuccessAlert";
import WarningAlert from "../alerts/warningAlert/WarningAlert";
import { authFetch } from "../../auth/authFetch";

const CsvUploader = ({ isLoading, setIsLoading }) => {
  const [csvFile, setCsvFile] = useState(null);
  const [csvFileNames, setCsvFileNames] = useState([]);
  const [errorAlertText, setErrorAlertText] = useState("");
  const [successAlertText, setSuccessAlertText] = useState("");
  const [warningAlertText, setWarningAlertText] = useState(
    "La aplicación está cargando, por favor espere antes de usar."
  );

  // TODO: refactorizar los mensajes para no repetir código.
  const API_URL = process.env.REACT_APP_API_URL;
  useEffect(() => {
    const loadDefaultCsv = async () => {
      try {
        const response = await fetch(defaultCsv);
        const csvContent = await response.text();
        const csvBlob = new Blob([csvContent], { type: "text/csv" });
        const csvFile = new File([csvBlob], "Lagos.csv");

        handleSave(csvFile);
      } catch (error) {
        setErrorAlertText(
          "Hubo un error al intentar cargar el CSV, inténtelo de nuevo."
        );
        setTimeout(() => {
          setErrorAlertText("");
        }, 3000);
        setSuccessAlertText("");
        setWarningAlertText("");
      }
    };

    // Llamar a la función para cargar el archivo CSV predeterminado
    loadDefaultCsv();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Función para manejar la carga del archivo CSV en el front
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type === "text/csv") {
      setCsvFile(file);
    } else {
      setWarningAlertText("Por favor, seleccione un archivo CSV.");
      setTimeout(() => {
        setWarningAlertText("");
      }, 3000);
      setSuccessAlertText("");
      setErrorAlertText("");
      setCsvFile(null);
    }
  };

  // Función para enviar el archivo CSV al back y guardarlo en la BD
  const handleSave = (defaultCsvFile) => {
    let file;
    if (csvFile) {
      if (csvFileNames.includes(csvFile?.name)) {
        setErrorAlertText("Ya existe un CSV con ese nombre.");
        setTimeout(() => {
          setErrorAlertText("");
        }, 3000);
        setCsvFile(null);
        setSuccessAlertText("");
        setWarningAlertText("");
        return;
      }
      file = csvFile;
    } else {
      file = defaultCsvFile;
    }

    if (file) {
      const formData = new FormData();
      formData.append("csv", file);

      authFetch(`${API_URL}/uploadCsv`, {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((jsonData) => {
          if (jsonData?.error) {
            setErrorAlertText(jsonData.error);
            setTimeout(() => {
              setErrorAlertText("");
            }, 3000);
            setSuccessAlertText("");
            setWarningAlertText("");
            setCsvFile(null);
            return;
          }
          updateCsvOptions(jsonData);
          setCsvFile(null);
          if (file !== defaultCsvFile) {
            setSuccessAlertText("CSV cargado correctamente.");
            setCsvFileNames((prevCsvFileNames) => [
              ...prevCsvFileNames,
              file?.name,
            ]);
            setTimeout(() => {
              setSuccessAlertText("");
            }, 3000);
            setErrorAlertText("");
            setWarningAlertText("");
          } else {
            setIsLoading(false);
            setSuccessAlertText("¡Ya podés empezar a utilizar la aplicación!");
            setTimeout(() => {
              setSuccessAlertText("");
            }, 5000);
            setErrorAlertText("");
            setWarningAlertText("");
          }
        })
        .catch((error) => {
          setWarningAlertText(
            "La aplicación está cargando, por favor espere antes de usar."
          );
          setSuccessAlertText("");
          setErrorAlertText("");
        });
    } else {
      setWarningAlertText(
        "Por favor, seleccione un archivo CSV antes de guardar."
      );
      setTimeout(() => {
        setWarningAlertText("");
      }, 3000);
      setSuccessAlertText("");
      setErrorAlertText("");
    }
  };

  const updateCsvOptions = (jsonData) => {
    BlocksService.onCsvUpload({
      id: jsonData.csvId,
      filename: jsonData?.fileName,
      columnsNames: jsonData?.columnsNames,
    });
  };

  return (
    <>
      <label
        htmlFor="files"
        className={`btn btn-primary ${isLoading ? "disabled" : ""}`}
      >
        Cargar CSV
      </label>
      <input
        id="files"
        accept=".csv"
        type="file"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      {csvFile?.name && (
        <div className="margin-right margin-left overflow-ellipsis">
          {csvFile.name}
        </div>
      )}
      {csvFile && (
        <button
          disabled={isLoading}
          className="btn btn-success margin-right"
          onClick={handleSave}
        >
          Confirmar carga de CSV
        </button>
      )}
      {errorAlertText && errorAlertText !== "" && (
        <ErrorAlert errorAlertText={errorAlertText} />
      )}
      {successAlertText && successAlertText !== "" && (
        <SuccessAlert successAlertText={successAlertText} />
      )}
      {warningAlertText && warningAlertText !== "" && (
        <WarningAlert warningAlertText={warningAlertText} />
      )}
      {isLoading && (
        <div
          className="spinner-border text-secondary spinner-style mobile-spinner"
          role="status"
        >
          <span className="visually-hidden">Loading...</span>
        </div>
      )}
    </>
  );
};

export default CsvUploader;
