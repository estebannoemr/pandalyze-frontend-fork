import React, { useEffect, useMemo, useState, useCallback } from "react";
import "./ChallengesSection.css";
import GamificationProfile from "./GamificationProfile";
import Leaderboard from "./Leaderboard";
import {
  getChallenges,
  getGamificationStatus,
} from "./challengesApi";

// Colores y etiquetas por dificultad
const DIFFICULTY_LABELS = {
  basico: "Básico",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

const CATEGORY_LABELS = {
  lectura: "Lectura",
  filtrado: "Filtrado",
  agrupamiento: "Agrupamiento",
  estadisticas: "Estadísticas",
  visualizacion: "Visualización",
};

// Lógica de desbloqueo progresivo
const isUnlocked = (challenge, completedIds, allChallenges) => {
  if (challenge.difficulty === "basico") return true;
  if (challenge.difficulty === "intermedio") {
    const completedBasicos = allChallenges.filter(
      (c) => c.difficulty === "basico" && completedIds.includes(c.id)
    ).length;
    return completedBasicos >= 2;
  }
  if (challenge.difficulty === "avanzado") {
    const completedIntermedios = allChallenges.filter(
      (c) => c.difficulty === "intermedio" && completedIds.includes(c.id)
    ).length;
    return completedIntermedios >= 2;
  }
  return false;
};

const ChallengesSection = ({
  apiUrl,
  activeChallenge,
  onStartChallenge,
  completedIds,
  setCompletedIds,
  totalPoints,
  setTotalPoints,
}) => {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("todos");
  const [categoryFilter, setCategoryFilter] = useState("todos");

  const [gamificationStatus, setGamificationStatus] = useState({
    total_points: 0,
    level: 1,
    level_title: "Analista Trainee",
    next_level_points: 50,
    completed_challenges: [],
    badges: [],
    all_badges: [],
    challenges_by_difficulty: { basico: 0, intermedio: 0, avanzado: 0 },
  });

  // ------------------------------------------------------------------
  // Carga inicial: el backend es la única fuente de verdad
  // ------------------------------------------------------------------
  const refreshStatus = useCallback(async () => {
    try {
      const status = await getGamificationStatus(apiUrl);
      setGamificationStatus(status);
      if (Array.isArray(status.completed_challenges)) {
        setCompletedIds(status.completed_challenges);
        setTotalPoints(status.total_points || 0);
      }
    } catch (e) {
      console.warn("No se pudo actualizar el estado de gamificación:", e);
    }
  }, [apiUrl, setCompletedIds, setTotalPoints]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErrorMsg("");
        const list = await getChallenges(apiUrl);
        if (!cancelled) setChallenges(list || []);
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(
            "No pudimos cargar los desafíos del servidor. Revisá tu conexión o intentá más tarde."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
      await refreshStatus();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  // Cuando cambia el desafío activo (por ejemplo al completar uno), refrescamos
  // el estado para reflejar badges/niveles actualizados.
  useEffect(() => {
    if (!activeChallenge) {
      refreshStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChallenge]);

  // ------------------------------------------------------------------
  // Filtros
  // ------------------------------------------------------------------
  const filteredChallenges = useMemo(() => {
    return challenges.filter((c) => {
      if (difficultyFilter !== "todos" && c.difficulty !== difficultyFilter)
        return false;
      if (categoryFilter !== "todos" && c.category !== categoryFilter)
        return false;
      return true;
    });
  }, [challenges, difficultyFilter, categoryFilter]);

  const categoriesPresent = useMemo(() => {
    const set = new Set(challenges.map((c) => c.category).filter(Boolean));
    return Array.from(set);
  }, [challenges]);

  // ------------------------------------------------------------------
  // Derivados de gamificación
  // ------------------------------------------------------------------
  const level = gamificationStatus?.level || 1;
  const levelTitle = gamificationStatus?.level_title || "Analista Trainee";
  const nextLevelPoints = gamificationStatus?.next_level_points || 50;
  const badges = gamificationStatus?.badges || [];
  const allBadges = gamificationStatus?.all_badges || [];

  const handleStart = (challenge) => {
    if (!isUnlocked(challenge, completedIds, challenges)) return;
    if (typeof onStartChallenge === "function") {
      onStartChallenge(challenge);
    }
  };

  return (
    <div className="challenges-section">
      {/* Perfil de gamificación */}
      <GamificationProfile
        totalPoints={totalPoints}
        level={level}
        levelTitle={levelTitle}
        nextLevelPoints={nextLevelPoints}
        badges={badges}
        allBadges={allBadges}
        completedCount={completedIds.length}
        totalChallenges={challenges.length}
      />

      {/* Leaderboard anónimo: visible para todos los usuarios autenticados */}
      <Leaderboard apiUrl={apiUrl} />

      {/* Filtros */}
      <div className="challenges-filters">
        <div className="challenges-filter-group">
          <span className="challenges-filter-label">Dificultad:</span>
          {["todos", "basico", "intermedio", "avanzado"].map((d) => (
            <button
              key={d}
              className={`btn btn-sm challenges-filter-btn ${
                difficultyFilter === d ? "active" : ""
              } difficulty-${d}`}
              onClick={() => setDifficultyFilter(d)}
            >
              {d === "todos" ? "Todos" : DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>

        {categoriesPresent.length > 0 && (
          <div className="challenges-filter-group">
            <span className="challenges-filter-label">Categoría:</span>
            <button
              className={`btn btn-sm challenges-filter-btn ${
                categoryFilter === "todos" ? "active" : ""
              }`}
              onClick={() => setCategoryFilter("todos")}
            >
              Todas
            </button>
            {categoriesPresent.map((cat) => (
              <button
                key={cat}
                className={`btn btn-sm challenges-filter-btn ${
                  categoryFilter === cat ? "active" : ""
                }`}
                onClick={() => setCategoryFilter(cat)}
              >
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Estados */}
      {loading && (
        <div className="challenges-loading">Cargando desafíos...</div>
      )}
      {errorMsg && <div className="challenges-error">{errorMsg}</div>}

      {/* Grilla de desafíos */}
      {!loading && !errorMsg && (
        <div className="challenges-grid">
          {filteredChallenges.length === 0 && (
            <div className="challenges-empty">
              No hay desafíos para los filtros seleccionados.
            </div>
          )}
          {filteredChallenges.map((challenge) => {
            const completed = completedIds.includes(challenge.id);
            const unlocked = isUnlocked(challenge, completedIds, challenges);
            const isActive = activeChallenge?.id === challenge.id;

            return (
              <div
                key={challenge.id}
                className={`challenge-card difficulty-${challenge.difficulty} ${
                  completed ? "completed" : ""
                } ${!unlocked ? "locked" : ""} ${isActive ? "active" : ""}`}
              >
                <div className="challenge-card-header">
                  <span
                    className={`challenge-difficulty-badge difficulty-${challenge.difficulty}`}
                  >
                    {DIFFICULTY_LABELS[challenge.difficulty]}
                  </span>
                  <span className="challenge-points-badge">
                    {challenge.points} pts
                  </span>
                </div>

                <h4 className="challenge-card-title">
                  {completed && <span className="challenge-check">✅ </span>}
                  {!unlocked && <span className="challenge-lock">🔒 </span>}
                  {challenge.title}
                </h4>

                {challenge.category && (
                  <div className="challenge-card-category">
                    {CATEGORY_LABELS[challenge.category] || challenge.category}
                  </div>
                )}

                <p className="challenge-card-description">
                  {challenge.description}
                </p>

                <div className="challenge-card-footer">
                  {unlocked ? (
                    <button
                      className={`btn ${
                        completed ? "btn-outline-success" : "btn-primary"
                      } btn-sm`}
                      onClick={() => handleStart(challenge)}
                      disabled={isActive}
                    >
                      {isActive
                        ? "En curso..."
                        : completed
                        ? "Volver a intentar"
                        : "Comenzar"}
                    </button>
                  ) : (
                    <span className="challenge-locked-label">
                      🔒 Desbloqueá completando niveles previos
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChallengesSection;
