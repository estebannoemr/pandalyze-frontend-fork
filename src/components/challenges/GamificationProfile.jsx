import React from "react";

// Panel de perfil del usuario — muestra puntos, nivel, barra de progreso
// y la grilla de emblemas (obtenidos y bloqueados).
const GamificationProfile = ({
  totalPoints = 0,
  level = 1,
  levelTitle = "Analista Trainee",
  nextLevelPoints = 50,
  badges = [],
  allBadges = [],
  completedCount = 0,
  totalChallenges = 0,
}) => {
  // progreso porcentual hacia el siguiente nivel
  const safeTarget = nextLevelPoints > 0 ? nextLevelPoints : 1;
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round((totalPoints / safeTarget) * 100))
  );

  return (
    <div className="gamification-profile">
      <div className="gamification-profile-header">
        <div className="gamification-avatar" aria-hidden="true">
          🐼
        </div>
        <div className="gamification-profile-info">
          <div className="gamification-level-title">
            <span className="gamification-level-badge">Nivel {level}</span>
            <span className="gamification-level-name">{levelTitle}</span>
          </div>
          <div className="gamification-points">
            <strong>{totalPoints}</strong> puntos
            <span className="gamification-points-separator">·</span>
            <span>
              {completedCount}/{totalChallenges} desafíos completados
            </span>
          </div>
        </div>
      </div>

      <div className="gamification-progress-container">
        <div className="gamification-progress-labels">
          <span>{totalPoints} pts</span>
          <span>{nextLevelPoints} pts</span>
        </div>
        <div
          className="gamification-progress-bar"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            className="gamification-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {allBadges && allBadges.length > 0 && (
        <div className="gamification-badges">
          <h5 className="gamification-badges-title">Emblemas</h5>
          <div className="gamification-badges-grid">
            {allBadges.map((badge) => {
              const earned = badges.includes(badge.id);
              return (
                <div
                  key={badge.id}
                  className={`gamification-badge ${
                    earned ? "earned" : "locked"
                  }`}
                  title={`${badge.name}: ${badge.description}`}
                >
                  <div className="gamification-badge-emoji">
                    {earned ? badge.emoji : "🔒"}
                  </div>
                  <div className="gamification-badge-name">{badge.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default GamificationProfile;
