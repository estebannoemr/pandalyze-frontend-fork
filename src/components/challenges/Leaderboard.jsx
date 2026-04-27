import React, { useEffect, useState } from "react";
import { getLeaderboard } from "./challengesApi";
import "./Leaderboard.css";

/**
 * Leaderboard anónimo: top 10 alumnos por puntos.
 *
 * El backend devuelve los emails ya anonimizados (mismo prefijo + ***)
 * y opcionalmente la posición del usuario autenticado (``my_rank``)
 * para que pueda saber dónde está parado aunque no esté en el top.
 *
 * Se monta dentro de la pestaña Desafíos como módulo motivacional.
 */
export default function Leaderboard({ apiUrl }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await getLeaderboard(apiUrl);
      setData(r);
    } catch (e) {
      setError(e.message || "Error al cargar leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="leaderboard">
        <h3 className="leaderboard-title">🏅 Leaderboard</h3>
        <p className="leaderboard-loading">Cargando ranking...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard">
        <h3 className="leaderboard-title">🏅 Leaderboard</h3>
        <p className="leaderboard-error">{error}</p>
      </div>
    );
  }

  const top = (data && data.top) || [];
  const myRank = data && data.my_rank;

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <h3 className="leaderboard-title">🏅 Leaderboard</h3>
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={load}
          title="Refrescar ranking"
        >
          ⟳
        </button>
      </div>

      {top.length === 0 ? (
        <p className="leaderboard-empty">
          Todavía no hay alumnos con puntos. ¡Sé el primero en aparecer!
        </p>
      ) : (
        <ol className="leaderboard-list">
          {top.map((row, idx) => (
            <li key={idx} className="leaderboard-row">
              <span className="leaderboard-rank">
                {idx === 0
                  ? "🥇"
                  : idx === 1
                  ? "🥈"
                  : idx === 2
                  ? "🥉"
                  : `#${idx + 1}`}
              </span>
              <span className="leaderboard-name">{row.anon_email}</span>
              <span className="leaderboard-points">{row.points} pts</span>
              <span className="leaderboard-completed">
                {row.completed} desafíos
              </span>
            </li>
          ))}
        </ol>
      )}

      {myRank && (
        <p className="leaderboard-my-rank">
          Tu posición: <strong>#{myRank.position}</strong> de {myRank.of}{" "}
          alumnos.
        </p>
      )}
    </div>
  );
}
