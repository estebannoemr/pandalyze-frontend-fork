import { useEffect, useState, useCallback } from "react";
import "./App.css";
import BlocksEditor from "./components/blocksEditor/BlocksEditor";
import PythonEditor from "./components/pythonEditor/PythonEditor";
import WelcomeModal from "./components/welcomeModal/WelcomeModal";
import OutputConsole from "./components/outputConsole/OutputConsole";
import ChallengesSection from "./components/challenges/ChallengesSection";
import ChallengeModal from "./components/challenges/ChallengeModal";
import { getChallengeCsv } from "./components/challenges/challengesApi";
import {
  uploadCsvFile,
  csvStringToFile,
} from "./components/challenges/challengesCsvUploader";

const LS_COMPLETED = "pandalyze_completed";
const LS_POINTS = "pandalyze_points";

function App() {
  const API_URL = process.env.REACT_APP_API_URL;

  const [frontendCode, setFrontendCode] = useState("");
  const [backendCode, setBackendCode] = useState("");
  const [backendResponse, setBackendResponse] = useState({});
  const [showInitialInstructionsAlert, setShowInitialInstructionsAlert] =
    useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Sistema de tabs: "editor" | "challenges"
  const [activeTab, setActiveTab] = useState("editor");

  // Desafío actualmente activo (modal abierto sobre el editor)
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [challengeCsvStatus, setChallengeCsvStatus] = useState("idle");
  const [challengeCsvError, setChallengeCsvError] = useState("");

  // Estado de gamificación a nivel app (persistido en localStorage)
  const [completedIds, setCompletedIds] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_COMPLETED);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  });
  const [totalPoints, setTotalPoints] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_POINTS);
      return raw ? parseInt(raw, 10) : 0;
    } catch (_) {
      return 0;
    }
  });

  // Health check periódico para mantener el backend despierto
  const fetchHealthCheck = async () => {
    try {
      const response = await fetch(API_URL + "/healthCheck", { timeout: 5000 });
      if (response.ok) {
        console.log("Health Check successful");
      } else {
        console.error("Health Check failed");
      }
    } catch (error) {
      console.error("Error during Health Check:", error);
    }
  };

  useEffect(() => {
    fetchHealthCheck();
    const intervalId = setInterval(fetchHealthCheck, 180000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCode = (frontendCode, backendCode) => {
    setFrontendCode(frontendCode);
    setBackendCode(backendCode);
  };

  const handleCloseInitialAlert = () => setShowInitialInstructionsAlert(false);
  const handleOpenInitialAlert = () => setShowInitialInstructionsAlert(true);

  // Inicio de un desafío:
  //   1. pedimos el CSV al backend
  //   2. lo subimos al backend con /uploadCsv y lo registramos en BlocksService
  //   3. abrimos el modal y cambiamos al tab del editor
  const handleStartChallenge = useCallback(
    async (challenge) => {
      if (!challenge) return;

      setActiveChallenge(challenge);
      setChallengeCsvStatus("loading");
      setChallengeCsvError("");
      setActiveTab("editor");

      try {
        const csvInfo = await getChallengeCsv(API_URL, challenge.id);
        const file = csvStringToFile(csvInfo.csv_content, csvInfo.csv_filename);
        await uploadCsvFile(file, API_URL);
        setChallengeCsvStatus("ready");
      } catch (e) {
        setChallengeCsvStatus("error");
        setChallengeCsvError(e?.message || "Error desconocido");
      }
    },
    [API_URL]
  );

  const handleCloseChallenge = () => {
    setActiveChallenge(null);
    setChallengeCsvStatus("idle");
    setChallengeCsvError("");
  };

  // Callback cuando el modal informa un desafío aprobado
  const handleMarkCompleted = (challengeId, pointsEarned = 0) => {
    setCompletedIds((prev) => {
      if (prev.includes(challengeId)) return prev;
      const next = [...prev, challengeId];
      try {
        localStorage.setItem(LS_COMPLETED, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
    if (pointsEarned > 0) {
      setTotalPoints((prev) => {
        const next = prev + pointsEarned;
        try {
          localStorage.setItem(LS_POINTS, String(next));
        } catch (_) {}
        return next;
      });
    }
  };

  return (
    <div className="app-container">
      {showInitialInstructionsAlert && (
        <WelcomeModal handleCloseInitialAlert={handleCloseInitialAlert} />
      )}

      <div className="app-entire-title">
        <button
          className="btn btn-primary tutorial-button"
          onClick={handleOpenInitialAlert}
        >
          Ver tutorial
        </button>
        <div className="title-container">
          <span className="title">Pandalyze: </span>
          <span className="subtitle">
            aprender Ciencia de Datos con programación en bloques
          </span>
        </div>
      </div>

      {/* Tabs de navegación */}
      <div className="app-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "editor"}
          className={`app-tab ${activeTab === "editor" ? "active" : ""}`}
          onClick={() => setActiveTab("editor")}
        >
          Editor
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "challenges"}
          className={`app-tab ${activeTab === "challenges" ? "active" : ""}`}
          onClick={() => setActiveTab("challenges")}
        >
          Desafios
          {completedIds.length > 0 && (
            <span className="app-tab-badge">{completedIds.length}</span>
          )}
        </button>
      </div>

      {/* Contenido del tab: Editor - siempre montado para preservar Blockly */}
      <div
        className={`app-tab-panel ${
          activeTab === "editor" ? "active" : "inactive"
        }`}
      >
        <div className="editors-flex-container">
          <BlocksEditor
            updateCode={updateCode}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
          <PythonEditor
            isLoading={isLoading}
            frontendCode={frontendCode}
            backendCode={backendCode}
            setBackendResponse={setBackendResponse}
          />
        </div>
        <OutputConsole backendResponse={backendResponse} />
      </div>

      {/* Contenido del tab: Desafios */}
      {activeTab === "challenges" && (
        <div className="app-tab-panel active">
          <ChallengesSection
            apiUrl={API_URL}
            activeChallenge={activeChallenge}
            onStartChallenge={handleStartChallenge}
            completedIds={completedIds}
            setCompletedIds={setCompletedIds}
            totalPoints={totalPoints}
            setTotalPoints={setTotalPoints}
          />
        </div>
      )}

      {/* Modal flotante del desafio activo - se renderiza por encima del editor */}
      {activeChallenge && (
        <ChallengeModal
          apiUrl={API_URL}
          challenge={activeChallenge}
          backendResponse={backendResponse}
          csvStatus={challengeCsvStatus}
          csvError={challengeCsvError}
          onClose={handleCloseChallenge}
          onMarkCompleted={handleMarkCompleted}
        />
      )}
    </div>
  );
}

export default App;
