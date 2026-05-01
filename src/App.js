import { useEffect, useState, useCallback } from "react";
import "./App.css";
import BlocksEditor from "./components/blocksEditor/BlocksEditor";
import PythonEditor from "./components/pythonEditor/PythonEditor";
import WelcomeModal from "./components/welcomeModal/WelcomeModal";
import OutputConsole from "./components/outputConsole/OutputConsole";
import ChallengesSection from "./components/challenges/ChallengesSection";
import ChallengeModal from "./components/challenges/ChallengeModal";
import TeacherDashboard from "./components/teacher/TeacherDashboard";
import AdminDashboard from "./components/admin/AdminDashboard";
import StatsDashboard from "./components/stats/StatsDashboard";
import {
  loadChallengeCsvClientSide,
} from "./components/challenges/challengesCsvUploader";
import { useAuth } from "./auth/AuthContext";
import AuthPage from "./auth/AuthPage";
import ProfileModal from "./auth/ProfileModal";
import Blockly from "blockly";

function App() {
  const API_URL = process.env.REACT_APP_API_URL;

  const { user, isAuthenticated, bootstrapping, logout } = useAuth();

  const [frontendCode, setFrontendCode] = useState("");
  const [backendCode, setBackendCode] = useState("");
  const [backendResponse, setBackendResponse] = useState({});
  // Para usuarios autenticados: key por id. Para invitados: key genérica.
  const tutorialSeenKey = user ? `tutorial_seen_${user.id}` : "tutorial_seen_guest";
  const [showInitialInstructionsAlert, setShowInitialInstructionsAlert] =
    useState(false);

  // Mostrar tutorial automáticamente solo si nunca lo vio (por usuario o como invitado).
  // Se ejecuta cuando cambia tutorialSeenKey, es decir al cargar o al autenticarse.
  useEffect(() => {
    if (bootstrapping) return;
    try {
      if (!localStorage.getItem(tutorialSeenKey)) {
        setShowInitialInstructionsAlert(true);
      }
    } catch (_) {
      setShowInitialInstructionsAlert(true);
    }
  }, [tutorialSeenKey, bootstrapping]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("editor");

  const [showProfileModal, setShowProfileModal] = useState(false);

  const [activeChallenge, setActiveChallenge] = useState(null);
  const [challengeCsvStatus, setChallengeCsvStatus] = useState("idle");
  const [challengeCsvError, setChallengeCsvError] = useState("");

  const [completedIds, setCompletedIds] = useState([]);
  const [totalPoints, setTotalPoints] = useState(0);

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

  useEffect(() => {
    if (!isAuthenticated) {
      setCompletedIds([]);
      setTotalPoints(0);
      setActiveChallenge(null);
      setActiveTab((prev) =>
        prev === "challenges" ||
        prev === "teacher" ||
        prev === "admin" ||
        prev === "stats"
          ? "editor"
          : prev
      );
      return;
    }
    // Recién autenticado: si el usuario venía de la pantalla de login
    // (activeTab === "auth"), lo enviamos a un tab sensato según su rol.
    // Sin esto, el panel "auth" deja de renderizarse al pasar isAuthenticated
    // a true y la pantalla queda en blanco hasta que el usuario clickea un tab.
    setActiveTab((prev) => {
      if (prev !== "auth") return prev;
      if (user && user.role === "admin") return "admin";
      if (user && user.role === "docente") return "teacher";
      return "challenges";
    });
  }, [isAuthenticated, user]);

  const updateCode = (frontendCode, backendCode) => {
    setFrontendCode(frontendCode);
    setBackendCode(backendCode);
  };

  const handleCloseInitialAlert = () => {
    setShowInitialInstructionsAlert(false);
    if (tutorialSeenKey) {
      try { localStorage.setItem(tutorialSeenKey, "1"); } catch (_) {}
    }
  };
  const handleOpenInitialAlert = () => setShowInitialInstructionsAlert(true);

  const handleStartChallenge = useCallback(
    async (challenge) => {
      if (!challenge) return;

      setActiveChallenge(challenge);
      setChallengeCsvStatus("loading");
      setChallengeCsvError("");
      setActiveTab("editor");

      // Timing oculto: registramos el momento exacto en que el alumno
      // hizo click en "Comenzar". Se persiste en localStorage para que
      // sobreviva al cierre del modal (wall clock sigue corriendo).
      // Sólo se setea si no existe ya un start para este desafío,
      // así un reopen del modal no resetea el contador.
      try {
        const key = `challenge_start_${challenge.id}`;
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, new Date().toISOString());
        }
      } catch (_) {
        // localStorage puede fallar en modo privado; no es crítico.
      }

      try {
        // Flujo no-persist: descargamos el CSV al cliente y lo registramos
        // como inline en el BlocksService. /runPythonCode lo recibe en el
        // body de cada ejecución, sin escribir a la tabla csv_data.
        await loadChallengeCsvClientSide(API_URL, challenge);
        setChallengeCsvStatus("ready");
      } catch (e) {
        setChallengeCsvStatus("error");
        setChallengeCsvError((e && e.message) || "Error desconocido");
      }
    },
    [API_URL]
  );

  const handleCloseChallenge = () => {
    setActiveChallenge(null);
    setChallengeCsvStatus("idle");
    setChallengeCsvError("");
  };

  const handleMarkCompleted = (challengeId, pointsEarned = 0) => {
    setCompletedIds((prev) =>
      prev.includes(challengeId) ? prev : [...prev, challengeId]
    );
    if (pointsEarned > 0) {
      setTotalPoints((prev) => prev + pointsEarned);
    }
  };


  
  // Para evitar que desaparezca el editor cuando cambia de pestaña / inicia sesión / empieza un desafío.
  useEffect(() => {
    if (activeTab === "editor") {
      setTimeout(() => {
        try { Blockly.svgResize(Blockly.getMainWorkspace()); } catch (e) {}
      }, 200);
    }
  }, [activeTab]);



  if (bootstrapping) {
    return (
      <div className="app-bootstrapping">
        <p>Cargando...</p>
      </div>
    );
  }

  const isTeacher = user && user.role === "docente";
  const isAdmin = user && user.role === "admin";

  const showAuthOverlay = activeTab === "auth" && !isAuthenticated;

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
            aprender Ciencia de Datos con programacion en bloques
          </span>
        </div>
        <div className="app-user-box">
          {isAuthenticated ? (
            <>
              <span className="app-user-email">{user && user.email}</span>
              <span className="app-user-role">
                {isAdmin ? "Admin" : isTeacher ? "Docente" : "Alumno"}
              </span>
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => setShowProfileModal(true)}
                title="Editar perfil"
              >
                Mi perfil
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={logout}
              >
                Cerrar sesion
              </button>
            </>
          ) : (
            <>
              <span className="app-user-role">Invitado</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setActiveTab("auth")}
              >
                Iniciar sesion
              </button>
            </>
          )}
        </div>
      </div>

      <div className="app-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "editor"}
          className={"app-tab " + (activeTab === "editor" ? "active" : "")}
          onClick={() => setActiveTab("editor")}
        >
          Editor
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "challenges"}
          className={"app-tab " + (activeTab === "challenges" ? "active" : "")}
          onClick={() => {
            if (!isAuthenticated) {
              setActiveTab("auth");
              return;
            }
            setActiveTab("challenges");
          }}
          title={!isAuthenticated ? "Inicia sesion para acceder" : undefined}
        >
          Desafios
          {!isAuthenticated && <span className="app-tab-lock">LOCK</span>}
          {isAuthenticated && completedIds.length > 0 && (
            <span className="app-tab-badge">{completedIds.length}</span>
          )}
        </button>
        {isTeacher && (
          <button
            role="tab"
            aria-selected={activeTab === "teacher"}
            className={"app-tab " + (activeTab === "teacher" ? "active" : "")}
            onClick={() => setActiveTab("teacher")}
          >
            Mis alumnos
          </button>
        )}
        {isAdmin && (
          <button
            role="tab"
            aria-selected={activeTab === "admin"}
            className={"app-tab " + (activeTab === "admin" ? "active" : "")}
            onClick={() => setActiveTab("admin")}
          >
            Admin
          </button>
        )}
        {(isTeacher || isAdmin) && (
          <button
            role="tab"
            aria-selected={activeTab === "stats"}
            className={"app-tab " + (activeTab === "stats" ? "active" : "")}
            onClick={() => setActiveTab("stats")}
          >
            Estadisticas
          </button>
        )}
      </div>

      <div
        className={
          "app-tab-panel " + (activeTab === "editor" ? "active" : "inactive")
        }
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

      {activeTab === "challenges" && isAuthenticated && (
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

      {activeTab === "teacher" && isTeacher && (
        <div className="app-tab-panel active">
          <TeacherDashboard apiUrl={API_URL} classCode={user && user.class_code} />
        </div>
      )}

      {activeTab === "admin" && isAdmin && (
        <div className="app-tab-panel active">
          <AdminDashboard apiUrl={API_URL} />
        </div>
      )}

      {activeTab === "stats" && (isTeacher || isAdmin) && (
        <div className="app-tab-panel active">
          <StatsDashboard apiUrl={API_URL} isAdmin={isAdmin} />
        </div>
      )}

      {showAuthOverlay && (
        <div className="app-tab-panel active">
          <AuthPage onCancel={() => setActiveTab("editor")} />
        </div>
      )}

      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}

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
