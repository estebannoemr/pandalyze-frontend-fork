import React, { useEffect, useMemo, useState, useCallback } from "react";
import "./ChallengesSection.css";
import GamificationProfile from "./GamificationProfile";
import Leaderboard from "./Leaderboard";
import { useAuth } from "../../auth/AuthContext";
import {
  getChallenges,
  getGamificationStatus,
  createChallenge,
  getChallengeManage,
  updateChallenge,
  deleteChallenge,
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
  ordenamiento: "Ordenamiento",
};

const ensureCsvExtension = (name) => {
  const trimmed = (name || "").trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().endsWith(".csv") ? trimmed : `${trimmed}.csv`;
};

const getEmptyChallengeForm = () => ({
  title: "",
  difficulty: "basico",
  category: "lectura",
  points: 10,
  description: "",
  instructions: "",
  hint: "",
  csv_filename: "",
  csv_content: "",
  csv_url: "",
  theory_url: "",
  expected_keyword: "",
  solution_code: "",
  feedback_correct: "¡Excelente trabajo!",
  feedback_incorrect: "Todavía no coincide con lo esperado.",
  suggestion: "",
  time_limit_seconds: "",
});

// Campo del formulario de desafíos: la etiqueta y la ayuda quedan siempre
// visibles arriba del control (no dependen del placeholder, que desaparece
// al escribir o al volver a editar un desafío ya cargado).
const FormField = ({ label, help, optional, required, children }) => (
  <label className="challenge-form-field">
    <span className="challenge-form-label">
      {label}
      {required && <span className="challenge-form-required"> *</span>}
      {optional && <span className="challenge-form-optional"> (opcional)</span>}
    </span>
    {help && <span className="challenge-form-help">{help}</span>}
    {children}
  </label>
);

const CATEGORY_OPTIONS = [
  "lectura",
  "filtrado",
  "agrupamiento",
  "ordenamiento",
  "estadisticas",
  "visualizacion",
];

// Tablero de posiciones (top 10 anónimo y "tu posición"): DESACTIVADO.
// Se quitó de la pantalla porque la comparación entre estudiantes puede
// generar ansiedad y desmotivar a quienes más apoyo necesitan (ver el
// capítulo 3 de la tesina). No se borró nada: el componente Leaderboard.jsx y
// el endpoint GET /challenges/leaderboard siguen intactos. Para volver a
// mostrarlo, cambiar este valor a true.
const TABLERO_HABILITADO = false;

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
  const { user } = useAuth();
  const canCreateChallenge = user && (user.role === "docente" || user.role === "admin");

  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("todos");
  const [categoryFilter, setCategoryFilter] = useState("todos");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newChallenge, setNewChallenge] = useState(getEmptyChallengeForm());
  const [editingChallengeId, setEditingChallengeId] = useState(null);
  const [editChallenge, setEditChallenge] = useState(getEmptyChallengeForm());
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createOk, setCreateOk] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editOk, setEditOk] = useState("");
  const [csvSourceMode, setCsvSourceMode] = useState("content");
  const [editCsvSourceMode, setEditCsvSourceMode] = useState("content");

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

  const loadChallenges = useCallback(async () => {
    const list = await getChallenges(apiUrl);
    setChallenges(list || []);
  }, [apiUrl]);

  // ------------------------------------------------------------------
  // Carga inicial: el backend es la única fuente de verdad
  // ------------------------------------------------------------------
  const refreshStatus = useCallback(async () => {
    try {
      const status = await getGamificationStatus(apiUrl);
      // Si el usuario es docente o admin, forzamos el rango por defecto
      // a 'Analista Senior' (nivel 5) según la petición del producto.
      if (user && (user.role === "docente" || user.role === "admin")) {
        const forced = {
          ...status,
          level: 5,
          level_title: "Analista Senior",
        };
        setGamificationStatus(forced);
      } else {
        setGamificationStatus(status);
      }
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
        await loadChallenges();
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
  }, [apiUrl, loadChallenges, user && user.class_id]);

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

  const visibleSections =
    difficultyFilter === "todos"
      ? ["basico", "intermedio", "avanzado"]
      : [difficultyFilter];

  const groupedByDifficulty = useMemo(() => {
    const out = {
      basico: [],
      intermedio: [],
      avanzado: [],
    };
    filteredChallenges.forEach((c) => {
      if (out[c.difficulty]) out[c.difficulty].push(c);
    });
    return out;
  }, [filteredChallenges]);

  const editingChallenge = useMemo(
    () => challenges.find((challenge) => challenge.id === editingChallengeId) || null,
    [challenges, editingChallengeId]
  );

  // ------------------------------------------------------------------
  // Derivados de gamificación
  // ------------------------------------------------------------------
  const level = gamificationStatus?.level || 1;
  const levelTitle = gamificationStatus?.level_title || "Analista Trainee";
  const nextLevelPoints = gamificationStatus?.next_level_points || 50;
  const badges = gamificationStatus?.badges || [];
  const allBadges = gamificationStatus?.all_badges || [];

  const handleStart = (challenge) => {
    if (!isTeacherView && !isUnlocked(challenge, completedIds, challenges)) return;
    if (typeof onStartChallenge === "function") {
      onStartChallenge(challenge);
    }
  };

  const isTeacherView = user && (user.role === "docente" || user.role === "admin");

  const setSpanishRequiredMessage = (e) => {
    e.target.setCustomValidity("Completá este campo.");
  };

  const clearSpanishRequiredMessage = (e) => {
    e.target.setCustomValidity("");
  };

  const fillChallengeForm = (challenge, setFormState, setModeState) => {
    setModeState(challenge.csv_url ? "link" : "content");
    setFormState({
      ...getEmptyChallengeForm(),
      title: challenge.title || "",
      difficulty: challenge.difficulty || "basico",
      category: challenge.category || "",
      points: challenge.points || 10,
      description: challenge.description || "",
      instructions: Array.isArray(challenge.instructions)
        ? challenge.instructions.join("\n")
        : "",
      hint: challenge.hint || "",
      csv_filename: challenge.csv_filename || "",
      csv_content: challenge.csv_content || "",
      csv_url: challenge.csv_url || "",
      theory_url: challenge.theory_url || "",
      expected_keyword: challenge.expected_keyword || "",
      solution_code: challenge.solution_code || "",
      feedback_correct: challenge.feedback_correct || "¡Excelente trabajo!",
      feedback_incorrect:
        challenge.feedback_incorrect || "Todavía no coincide con lo esperado.",
      suggestion: challenge.suggestion || "",
      time_limit_seconds:
        challenge.time_limit_seconds != null
          ? String(challenge.time_limit_seconds)
          : "",
    });
  };

  const handleCsvFileSelected = async (file, setFormState) => {
    if (!file) return;
    const text = await file.text();
    setFormState((prev) => ({
      ...prev,
      csv_filename: ensureCsvExtension(file.name || prev.csv_filename),
      csv_content: text,
    }));
  };

  const resetCreateChallengeForm = () => {
    setCsvSourceMode("content");
    setNewChallenge(getEmptyChallengeForm());
    setCreateError("");
    setCreateOk("");
  };

  const resetEditChallengeForm = () => {
    setEditingChallengeId(null);
    setEditCsvSourceMode("content");
    setEditChallenge(getEmptyChallengeForm());
    setEditError("");
    setEditOk("");
  };

  const closeCreateChallengeForm = () => {
    resetCreateChallengeForm();
    setShowCreateForm(false);
  };

  const closeEditChallengeForm = () => {
    resetEditChallengeForm();
  };

  const beginEditChallenge = async (challengeId) => {
    if (!canCreateChallenge) return;
    setEditError("");
    setEditOk("");
    try {
      const data = await getChallengeManage(apiUrl, challengeId);
      const challenge = data?.challenge || {};
      setEditingChallengeId(challengeId);
      fillChallengeForm(challenge, setEditChallenge, setEditCsvSourceMode);
    } catch (e2) {
      const local = challenges.find((ch) => ch.id === challengeId);
      if (local) {
        setEditingChallengeId(challengeId);
        fillChallengeForm(local, setEditChallenge, setEditCsvSourceMode);
      } else {
        setEditError(e2.message || "No se pudo cargar el desafío para edición");
      }
    }
  };

  const onEditClick = (challengeId) => {
    if (!canCreateChallenge) return;
    setEditingChallengeId(challengeId);
    beginEditChallenge(challengeId);
  };

  const renderChallengeEditor = ({
    formState,
    setFormState,
    csvSourceModeValue,
    setCsvSourceModeValue,
    loading,
    errorMessage,
    okMessage,
    submitLabel,
    loadingLabel,
    onCancel,
    onSubmit,
  }) => (
    <form className="challenge-create-form challenge-inline-editor" onSubmit={onSubmit}>
      <p className="challenge-form-intro">
        Los campos marcados con <span className="challenge-form-required">*</span> son
        obligatorios. El estudiante ve la consigna, las instrucciones, la pista y la
        teoría; la solución y el resultado esperado se usan para corregir.
      </p>

      <h5 className="challenge-form-section-title">1. Datos generales</h5>
      <div className="challenge-create-grid">
        <FormField
          label="Título"
          required
          help="Nombre corto que aparece en la tarjeta del desafío."
        >
          <input
            type="text"
            placeholder="Ej.: ¿Cuántas filas tiene el dataset?"
            value={formState.title}
            onChange={(e) => setFormState((p) => ({ ...p, title: e.target.value }))}
            onInvalid={setSpanishRequiredMessage}
            onInput={clearSpanishRequiredMessage}
            required
          />
        </FormField>
        <FormField
          label="Dificultad"
          required
          help="Define en qué nivel aparece el desafío."
        >
          <select
            value={formState.difficulty}
            onChange={(e) => setFormState((p) => ({ ...p, difficulty: e.target.value }))}
          >
            <option value="basico">Básico</option>
            <option value="intermedio">Intermedio</option>
            <option value="avanzado">Avanzado</option>
          </select>
        </FormField>
        <FormField
          label="Categoría"
          optional
          help="Tipo de operación que se practica. Sirve para filtrar el catálogo."
        >
          <select
            value={formState.category}
            onChange={(e) => setFormState((p) => ({ ...p, category: e.target.value }))}
          >
            <option value="">Sin categoría</option>
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat] || cat}
              </option>
            ))}
            {formState.category && !CATEGORY_OPTIONS.includes(formState.category) && (
              <option value={formState.category}>{formState.category}</option>
            )}
          </select>
        </FormField>
        <FormField
          label="Puntos"
          required
          help="Se suman la primera vez que se resuelve. Sugerido: básico 10, intermedio 25, avanzado 50."
        >
          <input
            type="number"
            min="1"
            max="1000"
            value={formState.points}
            onChange={(e) => setFormState((p) => ({ ...p, points: e.target.value }))}
          />
        </FormField>
        <FormField
          label="Tiempo límite (segundos)"
          optional
          help="Solo para desafíos contrarreloj: el estudiante ve una cuenta regresiva. Dejalo vacío si no querés límite."
        >
          <input
            type="number"
            min="1"
            placeholder="Ej.: 120"
            value={formState.time_limit_seconds}
            onChange={(e) => setFormState((p) => ({ ...p, time_limit_seconds: e.target.value }))}
          />
        </FormField>
      </div>

      <h5 className="challenge-form-section-title">2. Consigna</h5>
      <FormField
        label="Consigna"
        required
        help="Qué tiene que averiguar el estudiante. Es el texto principal del desafío."
      >
        <textarea
          placeholder="Ej.: El dataset tiene información de estudiantes. Averiguá cuántos registros tiene en total."
          value={formState.description}
          onChange={(e) => setFormState((p) => ({ ...p, description: e.target.value }))}
          onInvalid={setSpanishRequiredMessage}
          onInput={clearSpanishRequiredMessage}
          required
        />
      </FormField>
      <FormField
        label="Instrucciones"
        optional
        help="Pasos sugeridos para resolverlo, uno por línea. Se muestran como lista numerada."
      >
        <textarea
          placeholder={"Ej.:\nCargá el CSV con el bloque de leer CSV.\nImprimí el resultado en consola."}
          value={formState.instructions}
          onChange={(e) => setFormState((p) => ({ ...p, instructions: e.target.value }))}
        />
      </FormField>
      <FormField
        label="Pista"
        optional
        help="Ayuda que el estudiante puede desplegar si se traba. Conviene que oriente sin dar la respuesta."
      >
        <textarea
          placeholder="Ej.: Buscá en la categoría Información un bloque que devuelva las dimensiones."
          value={formState.hint}
          onChange={(e) => setFormState((p) => ({ ...p, hint: e.target.value }))}
        />
      </FormField>
      <FormField
        label="Enlace a teoría"
        optional
        help="Material de consulta (documentación, apunte o video) que se abre en otra pestaña."
      >
        <input
          type="url"
          placeholder="https://..."
          value={formState.theory_url}
          onChange={(e) => setFormState((p) => ({ ...p, theory_url: e.target.value }))}
        />
      </FormField>

      <h5 className="challenge-form-section-title">3. Dataset</h5>
      <div className="challenge-create-source-toggle">
        <span className="challenge-form-label">¿De dónde sale el CSV?</span>
        <label>
          <input
            type="radio"
            name={`${submitLabel}-csv-source-mode`}
            checked={csvSourceModeValue === "content"}
            onChange={() => setCsvSourceModeValue("content")}
          />
          Subir un archivo o pegar el contenido
        </label>
        <label>
          <input
            type="radio"
            name={`${submitLabel}-csv-source-mode`}
            checked={csvSourceModeValue === "link"}
            onChange={() => setCsvSourceModeValue("link")}
          />
          Usar un enlace (URL)
        </label>
      </div>
      <FormField
        label="Nombre del archivo CSV"
        required
        help="Nombre con el que el estudiante verá el dataset en el bloque de leer CSV."
      >
        <input
          type="text"
          placeholder="Ej.: estudiantes.csv"
          value={formState.csv_filename}
          onChange={(e) => setFormState((p) => ({ ...p, csv_filename: e.target.value }))}
          onBlur={(e) =>
            setFormState((p) => ({
              ...p,
              csv_filename: ensureCsvExtension(e.target.value),
            }))
          }
          onInvalid={setSpanishRequiredMessage}
          onInput={clearSpanishRequiredMessage}
          required
        />
      </FormField>
      {csvSourceModeValue === "content" ? (
        <>
          <FormField
            label="Cargar el CSV desde un archivo"
            optional
            help="Al elegir un archivo se completan solos el nombre y el contenido."
          >
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) =>
                handleCsvFileSelected(
                  e.target.files && e.target.files[0],
                  setFormState
                )
              }
            />
          </FormField>
          <FormField
            label="Contenido del CSV"
            required
            help="La primera fila tiene que tener los nombres de las columnas."
          >
            <textarea
              placeholder={"Ej.:\nnombre,edad\nAna,15\nLuis,16"}
              value={formState.csv_content}
              onChange={(e) => setFormState((p) => ({ ...p, csv_content: e.target.value }))}
              onInvalid={setSpanishRequiredMessage}
              onInput={clearSpanishRequiredMessage}
              required
            />
          </FormField>
        </>
      ) : (
        <FormField
          label="Enlace público al CSV"
          required
          help="Enlace de descarga directa. También sirven enlaces compartidos de Google Drive o Google Sheets."
        >
          <input
            type="url"
            placeholder="https://..."
            value={formState.csv_url}
            onChange={(e) => setFormState((p) => ({ ...p, csv_url: e.target.value }))}
            onInvalid={setSpanishRequiredMessage}
            onInput={clearSpanishRequiredMessage}
            required
          />
        </FormField>
      )}

      <h5 className="challenge-form-section-title">4. Corrección automática</h5>
      <FormField
        label="Solución de referencia (Python)"
        required
        help="Código que resuelve el desafío. Armalo con bloques en el Editor y copiá el código Python generado. Se compara con la respuesta del estudiante y se le muestra si pide ver la solución."
      >
        <textarea
          className="challenge-form-code"
          placeholder={"Ej.:\ndf = read_csv(csv_id)\nprint(df.shape)"}
          value={formState.solution_code}
          onChange={(e) => setFormState((p) => ({ ...p, solution_code: e.target.value }))}
          onInvalid={setSpanishRequiredMessage}
          onInput={clearSpanishRequiredMessage}
          required
        />
      </FormField>
      <FormField
        label="Resultado esperado"
        required
        help="Texto que tiene que aparecer en la consola para dar el desafío por resuelto. Ejecutá la solución de referencia y copiá de la salida un valor bien específico."
      >
        <textarea
          className="challenge-form-code"
          placeholder="Ej.: (25000, 16)"
          value={formState.expected_keyword}
          onChange={(e) => setFormState((p) => ({ ...p, expected_keyword: e.target.value }))}
          onInvalid={setSpanishRequiredMessage}
          onInput={clearSpanishRequiredMessage}
          required
        />
      </FormField>

      <h5 className="challenge-form-section-title">5. Mensajes para el estudiante</h5>
      <FormField
        label="Mensaje cuando la respuesta es correcta"
        optional
        help="Se muestra al aprobar. Podés aprovecharlo para explicar qué significa el resultado."
      >
        <textarea
          value={formState.feedback_correct}
          onChange={(e) => setFormState((p) => ({ ...p, feedback_correct: e.target.value }))}
        />
      </FormField>
      <FormField
        label="Mensaje cuando la respuesta es incorrecta"
        optional
        help="Se muestra cuando la salida no coincide con el resultado esperado."
      >
        <textarea
          value={formState.feedback_incorrect}
          onChange={(e) => setFormState((p) => ({ ...p, feedback_incorrect: e.target.value }))}
        />
      </FormField>
      <FormField
        label="Sugerencia"
        optional
        help="Orientación extra que acompaña al mensaje de error, para encarar el próximo intento."
      >
        <textarea
          placeholder="Ej.: Revisá que estés imprimiendo el DataFrame completo y no una sola columna."
          value={formState.suggestion}
          onChange={(e) => setFormState((p) => ({ ...p, suggestion: e.target.value }))}
        />
      </FormField>

      {errorMessage && <div className="challenges-error">{errorMessage}</div>}
      {okMessage && <div className="challenge-create-ok">{okMessage}</div>}
      <div className="challenge-create-actions challenge-create-actions-centered">
        <button
          className="btn btn-outline-secondary challenge-action-btn"
          type="button"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </button>
        <button
          className="btn btn-success fw-semibold challenge-action-btn"
          type="submit"
          disabled={loading}
        >
          {loading ? loadingLabel : submitLabel}
        </button>
      </div>
    </form>
  );

  const handleDeleteChallenge = async (challenge) => {
    if (!challenge?.can_manage) return;
    if (!window.confirm(`¿Eliminar el desafío '${challenge.title}'?`)) return;
    try {
      await deleteChallenge(apiUrl, challenge.id);
      await loadChallenges();
      if (editingChallengeId === challenge.id) {
        closeEditChallengeForm();
      }
    } catch (e2) {
      setEditError(e2.message || "No se pudo eliminar el desafío");
    }
  };

  const buildChallengePayload = (formState, csvModeValue) => ({
    ...formState,
    csv_filename: ensureCsvExtension(formState.csv_filename),
    points: parseInt(formState.points, 10),
    instructions: (formState.instructions || "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean),
    csv_content: csvModeValue === "content" ? formState.csv_content : "",
    csv_url: csvModeValue === "link" ? formState.csv_url : "",
    time_limit_seconds:
      formState.time_limit_seconds === ""
        ? null
        : parseInt(formState.time_limit_seconds, 10),
  });

  const submitCreateChallenge = async (e) => {
    e.preventDefault();
    if (!canCreateChallenge) return;
    setCreateError("");
    setCreateOk("");
    setCreateLoading(true);
    try {
      const payload = buildChallengePayload(newChallenge, csvSourceMode);
      await createChallenge(apiUrl, payload);
      setCreateOk("Desafío creado correctamente.");
      await loadChallenges();
      closeCreateChallengeForm();
    } catch (e2) {
      setCreateError(e2.message || "No se pudo guardar el desafío");
    } finally {
      setCreateLoading(false);
    }
  };

  const submitEditChallenge = async (e) => {
    e.preventDefault();
    if (!canCreateChallenge || !editingChallengeId) return;
    setEditError("");
    setEditOk("");
    setEditLoading(true);
    try {
      const payload = buildChallengePayload(editChallenge, editCsvSourceMode);
      await updateChallenge(apiUrl, editingChallengeId, payload);
      setEditOk("Desafío actualizado correctamente.");
      await loadChallenges();
      closeEditChallengeForm();
    } catch (e2) {
      setEditError(e2.message || "No se pudo guardar el desafío");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="challenges-section">
      {/* Perfil de gamificación: solo para estudiantes. Docentes y
          administradores no acumulan puntos ni emblemas. */}
      {!isTeacherView && (
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
      )}

      {/* Encabezado: deja en claro qué catálogo se está viendo y por qué. */}
      <div className="challenges-scope-header">
        {isTeacherView ? (
          <>
            <h2 className="challenges-scope-title">Catálogo de desafíos</h2>
            <p className="challenges-scope-text">
              Ves el catálogo completo.{" "}
              {user && user.role === "docente"
                ? 'Qué desafíos ve cada comisión se elige en la pestaña "Mis comisiones". '
                : ""}
              Podés abrir cualquier desafío con "Ver" para probarlo: tus
              intentos no suman puntos ni emblemas.
            </p>
          </>
        ) : user && user.class_name ? (
          <>
            <h2 className="challenges-scope-title">
              Desafíos de la comisión "{user.class_name}"
            </h2>
            <p className="challenges-scope-text">
              {user.teacher_name
                ? `Estos son los desafíos que ${user.teacher_name} eligió para tu comisión.`
                : "Estos son los desafíos que tu docente eligió para tu comisión."}
            </p>
          </>
        ) : (
          <>
            <h2 className="challenges-scope-title">Desafíos</h2>
            {!loading && !errorMsg && challenges.length === 0 ? (
              <p className="challenges-scope-text">
                Para poder ver los desafíos, abrí "Mi perfil" y sumate a tu
                comisión con el código que te dio tu docente.
              </p>
            ) : (
              <p className="challenges-scope-text">
                Todavía no estás en ninguna comisión, por eso ves el catálogo
                general. Si tu docente te dio un código de comisión, cargalo
                desde "Mi perfil" para ver los desafíos de tu curso.
              </p>
            )}
          </>
        )}
      </div>

      {/* Tablero de posiciones anónimo: desactivado (ver TABLERO_HABILITADO). */}
      {TABLERO_HABILITADO && <Leaderboard apiUrl={apiUrl} />}

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

        {canCreateChallenge && (
          <div className="challenge-create-actions challenge-create-actions-inline">
            <button
              className="btn challenge-create-trigger"
              onClick={() => setShowCreateForm((v) => !v)}
              type="button"
            >
              {showCreateForm ? "Ocultar creador" : "Crear nuevo desafío"}
            </button>
          </div>
        )}
      </div>

      {canCreateChallenge && showCreateForm && (
        <div className="challenge-create-panel challenge-create-panel-inline">
          {renderChallengeEditor({
            formState: newChallenge,
            setFormState: setNewChallenge,
            csvSourceModeValue: csvSourceMode,
            setCsvSourceModeValue: setCsvSourceMode,
            loading: createLoading,
            errorMessage: createError,
            okMessage: createOk,
            submitLabel: "Crear desafío",
            loadingLabel: "Creando...",
            onCancel: closeCreateChallengeForm,
            onSubmit: submitCreateChallenge,
          })}
        </div>
      )}

      {/* Estados */}
      {loading && (
        <div className="challenges-loading">Cargando desafíos...</div>
      )}
      {errorMsg && <div className="challenges-error">{errorMsg}</div>}

      {/* Secciones de desafíos por dificultad */}
      {!loading && !errorMsg && (
        <div>
          {filteredChallenges.length === 0 && challenges.length > 0 && (
            <div className="challenges-empty">
              No hay desafíos para los filtros seleccionados.
            </div>
          )}

          {visibleSections.map((section) => {
            const sectionChallenges = groupedByDifficulty[section] || [];
            if (sectionChallenges.length === 0) return null;

            return (
              <section key={section} className="challenges-difficulty-section">
                <h3 className={`challenges-section-title difficulty-${section}`}>
                  {DIFFICULTY_LABELS[section]}
                </h3>

                <div className="challenges-grid">
                  {sectionChallenges.map((challenge) => {
                    const completed = completedIds.includes(challenge.id);
                    const unlocked = isTeacherView || isUnlocked(challenge, completedIds, challenges);
                    const isActive = activeChallenge?.id === challenge.id;

                    return (
                      <div key={challenge.id} className="challenge-card-shell">
                        <div
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
                            {challenge.time_limit_seconds > 0 && (
                              <span
                                className="challenge-time-badge"
                                title="Desafío contrarreloj"
                              >
                                ⏱ {Math.floor(challenge.time_limit_seconds / 60)}:
                                {String(challenge.time_limit_seconds % 60).padStart(2, "0")}
                              </span>
                            )}
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
                              (() => {
                                const primaryLabel = isActive
                                  ? "En curso..."
                                  : isTeacherView
                                  ? "Ver"
                                  : completed
                                  ? "Volver a intentar"
                                  : "Comenzar";
                                return (
                                  <button
                                    className={`btn ${
                                      completed ? "btn-outline-success" : "btn-primary"
                                    } btn-sm`}
                                    onClick={() => handleStart(challenge)}
                                    disabled={isActive}
                                  >
                                    {primaryLabel}
                                  </button>
                                );
                              })()
                            ) : (
                              <span className="challenge-locked-label">
                                🔒 Desbloqueá completando niveles previos
                              </span>
                            )}

                            {challenge.can_manage && challenge.is_custom && (
                              <div className="challenge-manage-actions">
                                <button
                                  className="btn btn-outline-secondary btn-sm"
                                  type="button"
                                  onClick={() => onEditClick(challenge.id)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="btn btn-outline-danger btn-sm"
                                  type="button"
                                  onClick={() => handleDeleteChallenge(challenge)}
                                >
                                  Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {editingChallenge && editingChallenge.difficulty === section && (
                  <div className="challenge-editor-panel-below">
                    <div className="challenge-inline-editor-title">
                      Editando: {editingChallenge.title}
                    </div>
                    {renderChallengeEditor({
                      formState: editChallenge,
                      setFormState: setEditChallenge,
                      csvSourceModeValue: editCsvSourceMode,
                      setCsvSourceModeValue: setEditCsvSourceMode,
                      loading: editLoading,
                      errorMessage: editError,
                      okMessage: editOk,
                      submitLabel: "Guardar cambios",
                      loadingLabel: "Guardando...",
                      onCancel: closeEditChallengeForm,
                      onSubmit: submitEditChallenge,
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChallengesSection;
