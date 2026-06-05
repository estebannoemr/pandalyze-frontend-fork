import { useState } from "react";
import BlocksService from "./services/BlocksService";
import { pythonToWorkspaceState } from "./services/pythonToBlocks";
import "./PythonToBlocksModal.css";

// Modal solo para docentes: escribir codigo Python (subset pandas) y
// convertirlo automaticamente en bloques en el workspace.
const PLACEHOLDER = `df = read_csv("estudiantes.csv")
print(df.shape)
print(df[df["edad"] >= 18])`;

const PythonToBlocksModal = ({ onClose }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const handleConvert = () => {
    setError("");
    setOk(false);
    // csv_id se resuelve al dataset activo (el del desafio si hay uno cargado).
    // Se calcula ANTES de loadGeneratedBlocks, que limpia el workspace.
    const preferredCsvId = BlocksService.getActiveCsvId
      ? BlocksService.getActiveCsvId()
      : null;
    const { state, variables, error: parseError } = pythonToWorkspaceState(
      code,
      BlocksService.csvsData,
      { preferredCsvId, nameToId: (n) => BlocksService.nameToId(n) }
    );
    if (parseError) {
      setError(parseError);
      return;
    }
    const loadError = BlocksService.loadGeneratedBlocks(state, variables);
    if (loadError) {
      setError(loadError);
      return;
    }
    setOk(true);
  };

  return (
    <div className="p2b-overlay" role="dialog" aria-modal="true">
      <div className="p2b-modal">
        <div className="p2b-header">
          <h3>Codigo Python a bloques</h3>
          <button className="p2b-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <p className="p2b-hint">
          Pegá codigo Python (pandas) y se convierte en bloques. Cargá primero el
          CSV que uses para que los nombres de columnas se reconozcan. Soporta:
          read_csv, .shape/.head/.columns/.describe/.info/.dtypes,
          .mean/.max/.min/.sum/.count/.value_counts/.unique, filtros df[df["c"]
          &gt;= n], .sort_values, .groupby y print().
        </p>

        <textarea
          className="p2b-textarea"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          rows={10}
        />

        {error && <div className="p2b-error">{error}</div>}
        {ok && <div className="p2b-ok">Bloques generados en el editor.</div>}

        <div className="p2b-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cerrar
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleConvert}
            disabled={!code.trim()}
          >
            Convertir a bloques
          </button>
        </div>
      </div>
    </div>
  );
};

export default PythonToBlocksModal;
