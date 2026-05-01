import React, { useEffect, useMemo, useState } from "react";
import { getChallenges } from "../challenges/challengesApi";
import {
  listClasses,
  createClass,
  updateClass,
  deleteClass,
} from "./classesApi";
import "./MyClasses.css";

const DIFFICULTY_LABELS = {
  basico: "Básico",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};
const DIFFICULTY_ORDER = { basico: 0, intermedio: 1, avanzado: 2 };

// Editor in-place de una clase. Mostramos el código copiable, el nombre
// editable y el picker de desafíos con un "seleccionar todo" por
// dificultad y uno general. La edición se persiste con PATCH.
function ClassCard({ klass, allChallenges, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(klass.name);
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(klass.selected_challenge_ids || [])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(klass.name);
    setSelectedIds(new Set(klass.selected_challenge_ids || []));
  }, [klass.id, klass.name, klass.selected_challenge_ids]);

  const grouped = useMemo(() => {
    const acc = { basico: [], intermedio: [], avanzado: [] };
    allChallenges.forEach((c) => {
      if (acc[c.difficulty]) acc[c.difficulty].push(c);
      else acc.basico.push(c);
    });
    return acc;
  }, [allChallenges]);

  const toggleId = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(allChallenges.map((c) => c.id)));
  const selectNone = () => setSelectedIds(new Set());
  const selectByDifficulty = (diff, on) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      grouped[diff].forEach((c) => {
        if (on) next.add(c.id);
        else next.delete(c.id);
      });
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        selected_challenge_ids: Array.from(selectedIds),
      };
      const r = await updateClass(window.__pandalyzeApi, klass.id, payload);
      onUpdated(r.class);
      setEditing(false);
    } catch (e) {
      setError(e.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    if (
      !window.confirm(
        "¿Regenerar el código? Los alumnos que aún no se asociaron deberán usar el nuevo código."
      )
    )
      return;
    setSaving(true);
    setError("");
    try {
      const r = await updateClass(window.__pandalyzeApi, klass.id, {
        regenerate_code: true,
      });
      onUpdated(r.class);
    } catch (e) {
      setError(e.message || "No se pudo regenerar el código.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (
      !window.confirm(
        `Borrar la clase "${klass.name}"? Los alumnos quedarán sin clase pero conservan sus resultados.`
      )
    )
      return;
    try {
      await deleteClass(window.__pandalyzeApi, klass.id);
      onDeleted(klass.id);
    } catch (e) {
      setError(e.message || "No se pudo borrar.");
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(klass.class_code);
    } catch (_) {}
  };

  const totalSelected = selectedIds.size;
  const totalChallenges = allChallenges.length;

  return (
    <div className="myclasses-card">
      <div className="myclasses-card-head">
        {editing ? (
          <input
            className="form-control myclasses-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Nombre de la clase"
          />
        ) : (
          <h4 className="myclasses-card-title">{klass.name}</h4>
        )}
        <div className="myclasses-code-block">
          <span className="myclasses-code-label">Código:</span>
          <code className="myclasses-code-value" onClick={copyCode} title="Copiar">
            {klass.class_code}
          </code>
        </div>
      </div>

      <div className="myclasses-meta">
        <span>
          Alumnos: <b>{klass.students_count ?? 0}</b>
        </span>
        <span>
          Desafíos seleccionados:{" "}
          <b>
            {(klass.selected_challenge_ids || []).length} / {totalChallenges}
          </b>
        </span>
      </div>

      {editing ? (
        <>
          <div className="myclasses-bulk-actions">
            <button className="btn btn-sm btn-outline-primary" onClick={selectAll}>
              Seleccionar todos ({allChallenges.length})
            </button>
            <button className="btn btn-sm btn-outline-secondary" onClick={selectNone}>
              Deseleccionar todos
            </button>
            {["basico", "intermedio", "avanzado"].map((d) => (
              <span key={d} className="myclasses-bulk-group">
                <button
                  className={`btn btn-sm difficulty-${d}`}
                  onClick={() => selectByDifficulty(d, true)}
                >
                  + {DIFFICULTY_LABELS[d]}
                </button>
                <button
                  className="btn btn-sm btn-outline-dark"
                  onClick={() => selectByDifficulty(d, false)}
                  title={`Quitar todos los ${DIFFICULTY_LABELS[d]}`}
                >
                  −
                </button>
              </span>
            ))}
          </div>

          <div className="myclasses-challenge-grid">
            {["basico", "intermedio", "avanzado"].map((d) =>
              grouped[d].length > 0 ? (
                <div key={d} className="myclasses-difficulty-group">
                  <h5 className={`myclasses-difficulty-title difficulty-${d}`}>
                    {DIFFICULTY_LABELS[d]}
                  </h5>
                  {grouped[d].map((c) => (
                    <label key={c.id} className="myclasses-challenge-row">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleId(c.id)}
                      />
                      <span className="myclasses-challenge-title">
                        {c.title}
                      </span>
                      <span className="myclasses-challenge-points">
                        {c.points} pts
                      </span>
                      {c.time_limit_seconds > 0 && (
                        <span className="myclasses-challenge-timer">⏱</span>
                      )}
                    </label>
                  ))}
                </div>
              ) : null
            )}
          </div>

          <div className="myclasses-card-footer">
            <span className="myclasses-summary">
              {totalSelected} de {totalChallenges} desafíos seleccionados
            </span>
            <div className="myclasses-card-actions">
              <button
                className="btn btn-success btn-sm"
                onClick={save}
                disabled={saving || name.trim().length === 0}
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setEditing(false);
                  setName(klass.name);
                  setSelectedIds(new Set(klass.selected_challenge_ids || []));
                  setError("");
                }}
                disabled={saving}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="myclasses-card-actions">
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={() => setEditing(true)}
          >
            Editar
          </button>
          <button
            className="btn btn-outline-warning btn-sm"
            onClick={regenerate}
          >
            Regenerar código
          </button>
          <button className="btn btn-outline-danger btn-sm" onClick={remove}>
            Borrar
          </button>
        </div>
      )}

      {error && <div className="myclasses-error">{error}</div>}
    </div>
  );
}

// Form de creación: nombre + desafíos preseleccionados (default: todos).
function CreateClassForm({ allChallenges, onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectAll, setSelectAll] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const payload = selectAll
        ? { name: name.trim(), select_all: true }
        : { name: name.trim(), selected_challenge_ids: [] };
      const r = await createClass(window.__pandalyzeApi, payload);
      onCreated(r.class);
      setName("");
      setSelectAll(true);
      setOpen(false);
    } catch (err) {
      setError(err.message || "No se pudo crear la clase.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        ➕ Crear nueva clase
      </button>
    );
  }

  return (
    <form className="myclasses-create-form" onSubmit={submit}>
      <h4>Nueva clase</h4>
      <label className="myclasses-create-label">
        Nombre
        <input
          className="form-control"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={120}
          placeholder="Ej: Programación 2026 - Comisión A"
        />
      </label>
      <label className="myclasses-create-checkbox">
        <input
          type="checkbox"
          checked={selectAll}
          onChange={(e) => setSelectAll(e.target.checked)}
        />
        Incluir todos los desafíos disponibles ({allChallenges.length})
      </label>
      {!selectAll && (
        <div className="myclasses-create-hint">
          Vas a poder elegir los desafíos específicos después de crearla,
          desde el botón "Editar".
        </div>
      )}
      <div className="myclasses-card-actions">
        <button
          className="btn btn-success btn-sm"
          type="submit"
          disabled={saving || !name.trim()}
        >
          {saving ? "Creando…" : "Crear clase"}
        </button>
        <button
          className="btn btn-outline-secondary btn-sm"
          type="button"
          onClick={() => {
            setOpen(false);
            setName("");
            setError("");
          }}
          disabled={saving}
        >
          Cancelar
        </button>
      </div>
      {error && <div className="myclasses-error">{error}</div>}
    </form>
  );
}

export default function MyClasses({ apiUrl }) {
  // Truco para que ClassCard pueda usar la apiUrl sin recibirla como prop
  // (evitamos re-renders por cambio de identidad de la prop).
  window.__pandalyzeApi = apiUrl;

  const [classes, setClasses] = useState([]);
  const [allChallenges, setAllChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [{ classes: list }, ch] = await Promise.all([
        listClasses(apiUrl),
        getChallenges(apiUrl),
      ]);
      // Ordenamos los desafíos por dificultad y por ID para que el picker
      // tenga un orden estable.
      const sortedCh = [...(ch || [])].sort((a, b) => {
        const d = DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
        if (d !== 0) return d;
        return a.id - b.id;
      });
      setAllChallenges(sortedCh);
      setClasses(list || []);
    } catch (e) {
      setError(e.message || "No se pudieron cargar las clases.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  const handleCreated = (newClass) => {
    setClasses((prev) => [newClass, ...prev]);
  };
  const handleUpdated = (updated) => {
    setClasses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };
  const handleDeleted = (id) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="myclasses-section">
      <div className="myclasses-header">
        <h2>Mis clases</h2>
        <button className="btn btn-outline-primary btn-sm" onClick={refresh}>
          Actualizar
        </button>
      </div>

      <CreateClassForm
        allChallenges={allChallenges}
        onCreated={handleCreated}
      />

      {loading && <p>Cargando clases…</p>}
      {error && <div className="myclasses-error">{error}</div>}

      {!loading && !error && classes.length === 0 && (
        <p className="myclasses-empty">
          Todavía no tenés clases. Creá la primera con el botón "Crear nueva
          clase" y compartí el código con tus alumnos.
        </p>
      )}

      <div className="myclasses-list">
        {classes.map((klass) => (
          <ClassCard
            key={klass.id}
            klass={klass}
            allChallenges={allChallenges}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ))}
      </div>
    </div>
  );
}
