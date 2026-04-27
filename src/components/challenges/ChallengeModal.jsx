import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  validateChallenge,
  getChallengeSolution,
} from "./challengesApi";

const DIFFICULTY_LABELS = {
  basico: "Básico",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

// Helpers de timing oculto. start_time se fija cuando el alumno hace click
// en "Comenzar" (en App.js). active_seconds se acumula a cada unmount del
// modal, así si el alumno cierra y vuelve a abrir el contador no se pierde.
const readStartTime = (challengeId) => {
  try {
    return localStorage.getItem(`challenge_start_${challengeId}`) || null;
  } catch (_) {
    return null;
  }
};

const readActiveSeconds = (challengeId) => {
  try {
    const raw = localStorage.getItem(`challenge_active_${challengeId}`);
    const n = parseInt(raw || "0", 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch (_) {
    return 0;
  }
};

const writeActiveSeconds = (challengeId, value) => {
  try {
    localStorage.setItem(
      `challenge_active_${challengeId}`,
      String(Math.max(0, Math.floor(value)))
    );
  } catch (_) {
    // localStorage puede no estar disponible; no bloquea la experiencia.
  }
};

const clearTimingStorage = (challengeId) => {
  try {
    localStorage.removeItem(`challenge_start_${challengeId}`);
    localStorage.removeItem(`challenge_active_${challengeId}`);
  } catch (_) {
    // ignore
  }
};

// Modal flotante que acompaña al usuario mientras resuelve un desafío.
// No tapa el editor: se posiciona en la esquina inferior derecha y es
// minimizable para no obstaculizar el área de bloques.
const ChallengeModal = ({
  apiUrl,
  challenge,
  backendResponse,
  csvStatus, // "loading" | "ready" | "error"
  csvError,
  onClose,
  onMarkCompleted,
}) => {
  const [attempts, setAttempts] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | validating | passed | failed
  const [showHint, setShowHint] = useState(false);
  const [showTheory, setShowTheory] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [solutionCode, setSolutionCode] = useState("");
  const [result, setResult] = useState(null);
  const [lastVerifiedOutput, setLastVerifiedOutput] = useState(null);
  const [minimized, setMinimized] = useState(false);

  // Tracking de tiempo activo: cada vez que el modal se monta para un
  // desafío guardamos el instante para acumular al desmontarse.
  const sessionStartRef = useRef(null);
  const challengeIdRef = useRef(challenge?.id || null);

  // Resetear estado cuando cambia el desafío
  useEffect(() => {
    setAttempts(0);
    setPhase("idle");
    setShowHint(false);
    setShowTheory(false);
    setShowSolution(false);
    setSolutionCode("");
    setResult(null);
    setLastVerifiedOutput(null);
  }, [challenge?.id]);

  // Acumular active_seconds al desmontar/cambiar de desafío.
  useEffect(() => {
    const cid = challenge?.id;
    challengeIdRef.current = cid;
    sessionStartRef.current = Date.now();
    return () => {
      if (cid == null || sessionStartRef.current == null) return;
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - sessionStartRef.current) / 1000)
      );
      if (elapsed > 0) {
        writeActiveSeconds(cid, readActiveSeconds(cid) + elapsed);
      }
      sessionStartRef.current = null;
    };
  }, [challenge?.id]);

  // Output actualmente visible en la consola (para habilitar "Verificar")
  const currentOutput = useMemo(() => {
    if (!backendResponse) return null;
    if (backendResponse.codeExecutionError) return null;
    const raw = backendResponse.output;
    if (typeof raw !== "string") return null;
    return raw;
  }, [backendResponse]);

  const hasNewOutput =
    currentOutput !== null && currentOutput !== lastVerifiedOutput;

  const csvReady = csvStatus === "ready";
  const canVerify = csvReady && hasNewOutput && phase !== "validating";

  const handleVerify = async () => {
    if (!canVerify || !challenge) return;
    setPhase("validating");
    // Snapshot de timing al momento de verificar.
    const startTime = readStartTime(challenge.id);
    const storedActive = readActiveSeconds(challenge.id);
    const sessionElapsed =
      sessionStartRef.current != null
        ? Math.max(0, Math.floor((Date.now() - sessionStartRef.current) / 1000))
        : 0;
    const activeSeconds = storedActive + sessionElapsed;
    try {
      const response = await validateChallenge(
        apiUrl,
        challenge.id,
        currentOutput || "",
        { startTime, activeSeconds }
      );
      setResult(response);
      setLastVerifiedOutput(currentOutput);
      setAttempts((a) => a + 1);
      if (response.passed) {
        setPhase("passed");
        // Al aprobar, limpiamos los contadores: un futuro reintento
        // (si se permitiera) empezaría de cero.
        clearTimingStorage(challenge.id);
        sessionStartRef.current = null;
        if (typeof onMarkCompleted === "function") {
          onMarkCompleted(challenge.id, response.points_earned || 0, response.first_try);
        }
      } else {
        setPhase("failed");
      }
    } catch (e) {
      setResult({
        passed: false,
        message: "No pudimos verificar tu respuesta.",
        feedback:
          "Ocurrió un problema al comunicarnos con el servidor. Volvé a intentar en unos segundos.",
        suggestion: null,
      });
      setPhase("failed");
    }
  };

  const handleRevealSolution = async () => {
    if (!challenge) return;
    try {
      const response = await getChallengeSolution(apiUrl, challenge.id);
      setSolutionCode(response?.solution_description || "");
      setShowSolution(true);
    } catch (e) {
      setSolutionCode("No se pudo obtener la solución en este momento.");
      setShowSolution(true);
    }
  };

  if (!challenge) return null;

  // Si está minimizado sólo mostramos la cabecera
  if (minimized) {
    return (
      <div className="challenge-modal minimized" role="dialog" aria-live="polite">
        <div className="challenge-modal-header">
          <span className="challenge-modal-title">
            🏆 {challenge.title}
          </span>
          <div className="challenge-modal-actions">
            <button
              className="challenge-modal-icon-btn"
              onClick={() => setMinimized(false)}
              title="Expandir"
              aria-label="Expandir"
            >
              🔼
            </button>
            <button
              className="challenge-modal-icon-btn"
              onClick={onClose}
              title="Cerrar"
              aria-label="Cerrar"
            >
              ✖
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="challenge-modal" role="dialog" aria-live="polite">
      <div className="challenge-modal-header">
        <div className="challenge-modal-title">🏆 {challenge.title}</div>
        <div className="challenge-modal-header-badges">
          <span
            className={`challenge-difficulty-badge difficulty-${challenge.difficulty}`}
          >
            {DIFFICULTY_LABELS[challenge.difficulty] || challenge.difficulty}
          </span>
        </div>
        <div className="challenge-modal-actions">
          <button
            className="challenge-modal-icon-btn"
            onClick={() => setMinimized(true)}
            title="Minimizar"
            aria-label="Minimizar"
          >
            🔽
          </button>
          <button
            className="challenge-modal-icon-btn"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
          >
            ✖
          </button>
        </div>
      </div>

      <div className="challenge-modal-body">
        {/* Estado del CSV cargado */}
        <div className="challenge-modal-section">
          {csvStatus === "loading" && (
            <div className="challenge-modal-dataset loading">
              ⏳ Cargando dataset <strong>{challenge.csv_filename}</strong>...
            </div>
          )}
          {csvStatus === "ready" && (
            <div className="challenge-modal-dataset">
              ✅ Dataset <strong>{challenge.csv_filename}</strong> cargado y
              disponible. Se agregó un bloque <em>"read_csv"</em> al workspace.
            </div>
          )}
          {csvStatus === "error" && (
            <div className="challenge-modal-dataset error">
              ❌ No se pudo cargar el dataset.{" "}
              {csvError || "Intentá volver a comenzar el desafío."}
            </div>
          )}
        </div>

        {/* Descripción breve */}
        <div className="challenge-modal-section">
          <p style={{ margin: 0 }}>{challenge.description}</p>
        </div>

        {/* Instrucciones */}
        <div className="challenge-modal-section">
          <strong>Instrucciones:</strong>
          <ol className="challenge-modal-instructions">
            {(challenge.instructions || []).map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </div>

        {/* Pista */}
        {challenge.hint && (
          <details
            className="challenge-modal-collapsible"
            open={showHint}
            onToggle={(e) => setShowHint(e.target.open)}
          >
            <summary>💡 Pista</summary>
            <p>{challenge.hint}</p>
          </details>
        )}

        {/* Teoría */}
        {challenge.theory_url && (
          <details
            className="challenge-modal-collapsible"
            open={showTheory}
            onToggle={(e) => setShowTheory(e.target.open)}
          >
            <summary>📚 Teoría</summary>
            <a
              className="challenge-modal-theory-link"
              href={challenge.theory_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir recurso externo ↗
            </a>
          </details>
        )}

        {/* Resultado */}
        {result && (
          <div
            className={`challenge-modal-result ${
              result.passed ? "passed" : "failed"
            }`}
          >
            <div className="challenge-modal-result-title">
              {result.passed
                ? `🎉 ¡Correcto!${
                    result.points_earned ? ` +${result.points_earned} pts` : ""
                  }`
                : "❌ Todavía no es correcto"}
            </div>
            <div>{result.feedback}</div>
            {result.suggestion && !result.passed && (
              <div style={{ marginTop: 6, fontStyle: "italic" }}>
                💡 {result.suggestion}
              </div>
            )}
            {result.first_try && result.passed && (
              <div style={{ marginTop: 6 }}>
                ⚡ ¡Lo lograste en el primer intento!
              </div>
            )}
          </div>
        )}

        {/* Solución (sólo tras 3 intentos fallidos o al pedir rendirse) */}
        {(attempts >= 3 || showSolution) && (
          <details
            className="challenge-modal-collapsible"
            open={showSolution}
            onToggle={(e) => setShowSolution(e.target.open)}
          >
            <summary>🏳 Ver solución</summary>
            {!solutionCode ? (
              <p>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleRevealSolution}
                >
                  Mostrar solución de referencia
                </button>
              </p>
            ) : (
              <pre>{solutionCode}</pre>
            )}
          </details>
        )}
      </div>

      <div className="challenge-modal-footer">
        <button
          className="btn btn-success"
          onClick={handleVerify}
          disabled={!canVerify}
          title={
            !csvReady
              ? "Esperá a que cargue el dataset"
              : !hasNewOutput
              ? "Ejecutá el código y volvé a verificar"
              : ""
          }
        >
          ✔ Verificar respuesta
        </button>
        {attempts >= 2 && phase !== "passed" && (
          <button
            className="btn btn-outline-warning"
            onClick={handleRevealSolution}
          >
            🏳 Rendirse
          </button>
        )}
        <button className="btn btn-outline-secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default ChallengeModal;
