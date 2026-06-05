// Conversor Python -> bloques (reverse codegen).
//
// Toma un subset acotado de pandas (el que los bloques pueden representar) y
// produce un "state" de serializacion de Blockly listo para
// Blockly.serialization.workspaces.load. Es la inversa de los generadores en
// constants/blocks/*. Subset soportado:
//   - read_csv("x") / pandas.read_csv("x") / pd.read_csv("x")
//   - EXPR.shape | .columns | .dtypes | .index | .values
//   - EXPR.head(N) | .tail(N) | .describe() | .info()
//   - EXPR.mean()|.max()|.min()|.sum()|.count()|.value_counts()|.unique()
//   - EXPR.isnull().sum()
//   - EXPR["col"]                          -> property
//   - EXPR[EXPR["col"] OP valor]           -> comparison (filtro booleano)
//   - EXPR.sort_values(by="col", ascending=True/False)
//   - EXPR.groupby("col") / .groupby(columna="col")
//   - primitivas: "texto", numero, True/False
//   - print(EXPR)                          -> sentencia print_with_argument
//   - generate_map(dataframe=, lat_col=, long_col=, category_col=) -> map_viewer
//   - plotly.bar/line/scatter(data_frame=, x=, y=, title=).show() -> showInConsole
//   - plotly.pie(data_frame=, values=, names=, title=).show()
//   - NAME = EXPR                          -> variables_set (crea variable real);
//                                             las referencias usan variables_get
//
// No soporta: imports, def, for/if, multiples columnas, operaciones no listadas.
// Ante algo no soportado lanza un Error con mensaje en espanol.

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------
const OPERATORS = ["==", "!=", ">=", "<=", ">", "<", "="];

function tokenize(line) {
  const tokens = [];
  let i = 0;
  const n = line.length;
  while (i < n) {
    const c = line[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    // strings
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let val = "";
      while (j < n && line[j] !== quote) {
        val += line[j];
        j++;
      }
      if (j >= n) throw new Error("String sin cerrar.");
      tokens.push({ t: "str", v: val });
      i = j + 1;
      continue;
    }
    // numbers
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(line[i + 1] || ""))) {
      let j = i;
      let val = "";
      while (j < n && /[0-9.]/.test(line[j])) {
        val += line[j];
        j++;
      }
      tokens.push({ t: "num", v: val });
      i = j;
      continue;
    }
    // identifiers / keywords
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      let val = "";
      while (j < n && /[A-Za-z0-9_]/.test(line[j])) {
        val += line[j];
        j++;
      }
      tokens.push({ t: "id", v: val });
      i = j;
      continue;
    }
    // operators (2-char first)
    const two = line.slice(i, i + 2);
    if (OPERATORS.includes(two)) {
      tokens.push({ t: "op", v: two });
      i += 2;
      continue;
    }
    if (OPERATORS.includes(c)) {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    if ("()[].,".includes(c)) {
      tokens.push({ t: "punc", v: c });
      i++;
      continue;
    }
    if ("+-*/%&|^".includes(c)) {
      throw new Error(
        `Operaciones aritmeticas o booleanas entre columnas (encontre "${c}") no tienen un bloque disponible.`
      );
    }
    throw new Error(`Caracter no soportado: "${c}".`);
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------
const OP_FIELD = {
  "==": "EQUAL",
  ">": "GREATER_THAN",
  "<": "LESS_THAN",
  ">=": "GREATER_THAN_OR_EQUAL",
  "<=": "LESS_THAN_OR_EQUAL",
  "!=": "NOT_EQUAL",
};

const SUFFIX_SIMPLE = {
  shape: { type: "shape", input: "VALUE" },
  columns: { type: "column", input: "VALUE" },
  dtypes: { type: "dtypes", input: "VALUE" },
  index: { type: "index", input: "argument" },
  values: { type: "values", input: "argument" },
};

const CALL_NOARG = {
  describe: { type: "describe", input: "VALUE" },
  info: { type: "info", input: "VALUE" },
  mean: { type: "mean", input: "VALUE" },
  max: { type: "max", input: "VALUE" },
  min: { type: "min", input: "VALUE" },
  sum: { type: "sum", input: "VALUE" },
  count: { type: "count", input: "VALUE" },
  value_counts: { type: "valueCounts", input: "VALUE" },
  unique: { type: "unique", input: "VALUE" },
};

class Parser {
  constructor(tokens, vars) {
    this.toks = tokens;
    this.pos = 0;
    this.vars = vars || new Map(); // nombre -> id de variable (variables_get/set)
  }

  peek(k = 0) {
    return this.toks[this.pos + k] || null;
  }
  next() {
    return this.toks[this.pos++] || null;
  }
  expectPunc(v) {
    const t = this.next();
    if (!t || t.t !== "punc" || t.v !== v) {
      throw new Error(`Se esperaba "${v}".`);
    }
  }
  isPunc(v, k = 0) {
    const t = this.peek(k);
    return t && t.t === "punc" && t.v === v;
  }
  isId(v, k = 0) {
    const t = this.peek(k);
    return t && t.t === "id" && t.v === v;
  }

  parseExpression() {
    return this.parsePostfix(this.parsePrimary());
  }

  parsePrimary() {
    const t = this.peek();
    if (!t) throw new Error("Expresion incompleta.");

    // read_csv("x") / pandas.read_csv("x") / pd.read_csv("x")
    if (t.t === "id" && (t.v === "pandas" || t.v === "pd") && this.isPunc(".", 1)) {
      this.next(); // pandas
      this.next(); // .
      const fn = this.next();
      if (!fn || fn.v !== "read_csv") throw new Error("Solo se soporta read_csv de pandas.");
      return this.parseReadCsvArgs();
    }
    if (t.t === "id" && t.v === "read_csv") {
      this.next();
      return this.parseReadCsvArgs();
    }
    // primitivas
    if (t.t === "str") {
      this.next();
      return { type: "primitive_text", fields: { TEXT: t.v } };
    }
    if (t.t === "num") {
      this.next();
      return { type: "primitive_number", fields: { NUMBER: Number(t.v) } };
    }
    if (t.t === "id" && (t.v === "True" || t.v === "False")) {
      this.next();
      return { type: "primitive_boolean", fields: { BOOLEAN: t.v === "True" ? "TRUE" : "FALSE" } };
    }
    // variable referenciada -> bloque variables_get (variable real, no inline)
    if (t.t === "id") {
      this.next();
      if (!this.vars.has(t.v)) {
        throw new Error(`Variable "${t.v}" no definida. Asignala antes con "${t.v} = ...".`);
      }
      return { type: "variables_get", fields: { variableGetterKey: this.vars.get(t.v) } };
    }
    throw new Error("No se pudo interpretar la expresion.");
  }

  parseReadCsvArgs() {
    this.expectPunc("(");
    // String entre comillas: "estudiantes.csv" o "123".
    if (this.peek() && this.peek().t === "str") {
      const s = this.next().v;
      this.expectPunc(")");
      return { type: "read_csv", fields: { csvOptions: s }, _csvRef: s, _csvPlaceholder: s === "csv_id" };
    }
    // Sin comillas: juntamos tokens hasta ")" para soportar nombres con punto
    // (students.csv) o el placeholder csv_id, tal como aparecen en solution_code.
    let ref = "";
    while (this.peek() && !this.isPunc(")")) {
      ref += this.next().v;
    }
    this.expectPunc(")");
    ref = ref.trim();
    if (!ref) throw new Error("read_csv necesita un argumento (nombre de archivo o csv_id).");
    return { type: "read_csv", fields: { csvOptions: ref }, _csvRef: ref, _csvPlaceholder: ref === "csv_id" };
  }

  // generate_map(dataframe=EXPR, lat_col='x', long_col='y', category_col='z')
  // -> bloque map_viewer (sentencia). Asume "generate_map" ya consumido.
  parseGenerateMap() {
    this.expectPunc("(");
    let df = null;
    let lat = "";
    let long = "";
    let category = "";
    while (this.peek() && !this.isPunc(")")) {
      const key = this.next();
      if (!key || key.t !== "id") throw new Error("generate_map espera argumentos key=value.");
      const eq = this.next();
      if (!eq || eq.t !== "op" || eq.v !== "=") throw new Error("generate_map espera key=value.");
      if (key.v === "dataframe") {
        df = this.parseExpression();
      } else if (key.v === "lat_col" || key.v === "long_col" || key.v === "category_col") {
        const s = this.next();
        if (!s || s.t !== "str") throw new Error(`${key.v} espera un texto entre comillas.`);
        if (key.v === "lat_col") lat = s.v;
        else if (key.v === "long_col") long = s.v;
        else category = s.v;
      } else {
        throw new Error(`generate_map: argumento "${key.v}" no soportado.`);
      }
      if (this.isPunc(",")) this.next();
    }
    this.expectPunc(")");
    if (!df) throw new Error("generate_map necesita dataframe=...");
    return {
      type: "map_viewer",
      extraState: { lat, long, category },
      inputs: { DATAFRAME: { block: df } },
    };
  }

  // plotly.bar/line/scatter(data_frame=, x=, y=, title=) o
  // plotly.pie(data_frame=, values=, names=, title=). Asume "plotly" consumido.
  // Devuelve el nodo del grafico (bloque output bar/line/pie/scatter).
  parsePlotlyChart() {
    this.expectPunc(".");
    const kindTok = this.next();
    if (!kindTok || kindTok.t !== "id") {
      throw new Error("plotly espera un tipo de grafico (bar, line, pie, scatter).");
    }
    const kind = kindTok.v;
    if (!["bar", "line", "scatter", "pie"].includes(kind)) {
      throw new Error(`plotly.${kind} no esta soportado (usa bar, line, pie o scatter).`);
    }
    const isPie = kind === "pie";
    this.expectPunc("(");
    const inputs = {};
    while (this.peek() && !this.isPunc(")")) {
      const key = this.next();
      if (!key || key.t !== "id") throw new Error("plotly espera argumentos key=value.");
      const eq = this.next();
      if (!eq || eq.t !== "op" || eq.v !== "=") throw new Error("plotly espera key=value.");
      const val = this.parseExpression();
      if (key.v === "data_frame") inputs.dataFrameValue = { block: val };
      else if (key.v === "x" || (isPie && key.v === "values")) inputs.xValue = { block: val };
      else if (key.v === "y" || (isPie && key.v === "names")) inputs.yValue = { block: val };
      else if (key.v === "title") inputs.title = { block: val };
      else throw new Error(`plotly.${kind}: argumento "${key.v}" no soportado.`);
      if (this.isPunc(",")) this.next();
    }
    this.expectPunc(")");
    return { type: kind, inputs };
  }

  // plotly.<kind>(...).show()  -> bloque showInConsole (sentencia) envolviendo el
  // grafico. Asume "plotly" en la posicion actual.
  parsePlotlyStatement() {
    this.next(); // plotly
    const chart = this.parsePlotlyChart();
    if (!this.isPunc(".")) {
      throw new Error("Agrega .show() para mostrar el grafico (ej. plotly.bar(...).show()).");
    }
    this.next(); // .
    const sh = this.next();
    if (!sh || sh.t !== "id" || sh.v !== "show") {
      throw new Error("Despues del grafico solo se soporta .show().");
    }
    this.expectPunc("(");
    this.expectPunc(")");
    return { type: "showInConsole", inputs: { VALUE: { block: chart } } };
  }

  parsePostfix(node) {
    while (true) {
      // property o filtro:  [ ... ]
      if (this.isPunc("[")) {
        this.next();
        node = this.parseBracket(node);
        continue;
      }
      // .algo
      if (this.isPunc(".")) {
        node = this.parseDot(node);
        continue;
      }
      break;
    }
    return node;
  }

  parseBracket(base) {
    const inner = this.parseExpression();
    // caso comparacion: base[ inner OP right ]
    const t = this.peek();
    if (t && t.t === "op" && t.v !== "=") {
      const op = this.next().v;
      const right = this.parseExpression();
      this.expectPunc("]");
      const col = columnFromProperty(inner);
      if (col == null) {
        throw new Error("En un filtro, la condicion debe ser df[\"columna\"] OP valor.");
      }
      return {
        type: "comparison",
        fields: { OPERATOR: OP_FIELD[op] },
        inputs: {
          dataFrameValue: { block: base },
          columnNameValue: { block: { type: "primitive_text", fields: { TEXT: col } } },
          rightValue: { block: right },
        },
      };
    }
    // caso property: base[ "col" ]
    this.expectPunc("]");
    if (inner.type !== "primitive_text") {
      throw new Error("Para seleccionar una columna usa comillas: df[\"columna\"].");
    }
    const col = inner.fields.TEXT;
    // Sin fields.dropdown a proposito: las opciones del dropdown se generan a
    // partir de las columnas del CSV. Si serializaramos un valor que todavia no
    // esta en las opciones, Blockly puede fallar al cargar. extraState aplica el
    // valor en FINISHED_LOADING (con try/catch) sin riesgo de crash.
    return {
      type: "property",
      extraState: { selectedOption: col },
      inputs: { blockInput: { block: base } },
    };
  }

  parseDot(base) {
    this.next(); // consume "."
    const name = this.next();
    if (!name || name.t !== "id") throw new Error("Se esperaba un atributo despues de \".\".");
    const attr = name.v;

    // sufijos sin parentesis: .shape .columns .dtypes .index .values
    if (SUFFIX_SIMPLE[attr] && !this.isPunc("(")) {
      const def = SUFFIX_SIMPLE[attr];
      return { type: def.type, inputs: { [def.input]: { block: base } } };
    }

    // .head(N) / .tail(N)
    if (attr === "head" || attr === "tail") {
      this.expectPunc("(");
      const num = this.next();
      if (!num || num.t !== "num") throw new Error(`${attr}() espera un numero, ej. ${attr}(3).`);
      this.expectPunc(")");
      return { type: attr, fields: { argument: String(parseInt(num.v, 10)) }, inputs: { VALUE: { block: base } } };
    }

    // .isnull().sum()  -> nullSum
    if (attr === "isnull") {
      this.expectPunc("(");
      this.expectPunc(")");
      if (!(this.isPunc(".") && this.isId("sum", 1))) {
        throw new Error("isnull() solo se soporta como isnull().sum().");
      }
      this.next(); // .
      this.next(); // sum
      this.expectPunc("(");
      this.expectPunc(")");
      return { type: "nullSum", inputs: { VALUE: { block: base } } };
    }

    // calls sin argumentos: describe/info/mean/max/min/sum/count/value_counts/unique
    if (CALL_NOARG[attr]) {
      this.expectPunc("(");
      this.expectPunc(")");
      const def = CALL_NOARG[attr];
      return { type: def.type, inputs: { [def.input]: { block: base } } };
    }

    // .groupby("col") o .groupby(columna="col")
    if (attr === "groupby") {
      this.expectPunc("(");
      if (this.isId("columna") && this.peek(1) && this.peek(1).v === "=") {
        this.next(); // columna
        this.next(); // =
      }
      const col = this.next();
      if (!col || col.t !== "str") throw new Error("groupby() espera el nombre de una columna entre comillas.");
      this.expectPunc(")");
      // Sin fields.groupbyColumn (mismo motivo que property): el dropdown
      // depende de las columnas del CSV. extraState lo aplica en load.
      return {
        type: "groupby",
        extraState: { selectedOption: col.v },
        inputs: { DATAFRAME: { block: base } },
      };
    }

    // .sort_values(by="col", ascending=True/False)
    if (attr === "sort_values") {
      this.expectPunc("(");
      let col = null;
      let ascending = "TRUE";
      while (!this.isPunc(")")) {
        const tk = this.peek();
        if (tk && tk.t === "id" && tk.v === "by" && this.peek(1) && this.peek(1).v === "=") {
          this.next();
          this.next();
          const s = this.next();
          if (!s || s.t !== "str") throw new Error("sort_values espera by=\"columna\".");
          col = s.v;
        } else if (tk && tk.t === "id" && tk.v === "ascending" && this.peek(1) && this.peek(1).v === "=") {
          this.next();
          this.next();
          const b = this.next();
          if (!b || b.t !== "id" || (b.v !== "True" && b.v !== "False")) {
            throw new Error("ascending espera True o False.");
          }
          ascending = b.v === "True" ? "TRUE" : "FALSE";
        } else if (tk && tk.t === "str" && col == null) {
          // forma posicional: sort_values("col")
          col = this.next().v;
        } else if (this.isPunc(",")) {
          this.next();
        } else {
          throw new Error("Argumento de sort_values no soportado.");
        }
      }
      this.expectPunc(")");
      if (col == null) {
        throw new Error(
          'sort_values() sin columna no tiene bloque: el bloque ordena por una columna (sort_values(by="...")).'
        );
      }
      return {
        type: "sort",
        fields: { BOOLEAN: ascending },
        inputs: {
          leftValue: { block: base },
          rightValue: { block: { type: "primitive_text", fields: { TEXT: col } } },
        },
      };
    }

    throw new Error(`Operacion ".${attr}" no tiene un bloque disponible.`);
  }
}

// Extrae el nombre de columna de un nodo property (df["col"]). El valor vive en
// extraState.selectedOption (ya no en fields.dropdown).
function columnFromProperty(node) {
  if (node && node.type === "property") {
    if (node.extraState && node.extraState.selectedOption != null) {
      return node.extraState.selectedOption;
    }
    if (node.fields && node.fields.dropdown != null) return node.fields.dropdown;
  }
  return null;
}

// DJB2 (fallback de nameToId): mismo algoritmo que BlocksService.nameToId, para
// que el id de variable sea determinístico y compatible.
function _djb2(name, h = 5381) {
  const s = String(name);
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString();
}

// ---------------------------------------------------------------------------
// Resolucion de read_csv -> id del csv (csvOptions guarda el id, no el filename)
// ---------------------------------------------------------------------------
function resolveCsvRefs(node, csvsData, preferredCsvId) {
  if (!node || typeof node !== "object") return;
  if (node.type === "read_csv" && node._csvRef != null) {
    const ref = String(node._csvRef);
    let resolved = ref;
    const hasCsvs = Array.isArray(csvsData) && csvsData.length > 0;
    const preferred = preferredCsvId != null ? String(preferredCsvId) : null;
    if (node._csvPlaceholder) {
      // placeholder tipo csv_id: priorizamos el CSV del desafio (preferred),
      // sino el primer CSV cargado.
      if (preferred) resolved = preferred;
      else if (hasCsvs) resolved = String(csvsData[0].id);
    } else {
      const byName = hasCsvs && csvsData.find((c) => c.filename === ref);
      const byId = hasCsvs && csvsData.find((c) => String(c.id) === ref);
      if (byName) resolved = String(byName.id);
      else if (byId) resolved = ref;
      // No matcheo por nombre/id: si estamos en un desafio (preferred), el
      // unico dataset relevante es el del desafio -> lo usamos.
      else if (preferred) resolved = preferred;
    }
    node.fields.csvOptions = resolved;
    delete node._csvRef;
    delete node._csvPlaceholder;
  }
  if (node.inputs) {
    Object.values(node.inputs).forEach(
      (inp) => inp && inp.block && resolveCsvRefs(inp.block, csvsData, preferredCsvId)
    );
  }
  if (node.next && node.next.block) resolveCsvRefs(node.next.block, csvsData, preferredCsvId);
}

// ---------------------------------------------------------------------------
// API publica
// ---------------------------------------------------------------------------
// Devuelve { state, variables, error }. state es el objeto para
// Blockly.serialization.workspaces.load. variables = [{id, name}] a registrar
// en BlocksService antes de cargar (para los dropdowns de variables_get/set).
// options.nameToId: funcion para derivar el id de una variable (DJB2 de
// BlocksService); si falta se usa un fallback equivalente.
export function pythonToWorkspaceState(code, csvsData, options = {}) {
  const preferredCsvId = options.preferredCsvId != null ? options.preferredCsvId : null;
  const nameToId = typeof options.nameToId === "function" ? options.nameToId : _djb2;
  try {
    // Aceptar texto pegado con escapes literales (ej. copiar el solution_code
    // de un JSON: "df = read_csv(csv_id)\nprint(...)\n"). Convertimos \n \r \t
    // a sus caracteres reales antes de partir en lineas.
    const normalized = String(code || "")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\n")
      .replace(/\\t/g, "  ");
    const rawLines = normalized.split("\n");
    const vars = new Map(); // nombre -> id (variable real)
    const statements = []; // nodos de sentencia, en orden

    for (let idx = 0; idx < rawLines.length; idx++) {
      let line = rawLines[idx];
      const hash = line.indexOf("#");
      if (hash >= 0) line = line.slice(0, hash);
      line = line.trim().replace(/;+$/, "");
      if (!line) continue;

      const tokens = tokenize(line);
      if (tokens.length === 0) continue;

      // print(EXPR)
      if (tokens[0].t === "id" && tokens[0].v === "print") {
        const p = new Parser(tokens, vars);
        p.next(); // print
        p.expectPunc("(");
        const arg = p.parseExpression();
        p.expectPunc(")");
        if (p.peek()) throw new Error(`Linea ${idx + 1}: texto extra despues de print(...).`);
        statements.push({ type: "print_with_argument", inputs: { ARGUMENT: { block: arg } } });
        continue;
      }

      // generate_map(dataframe=..., lat_col=..., long_col=..., category_col=...)
      if (tokens[0].t === "id" && tokens[0].v === "generate_map") {
        const p = new Parser(tokens, vars);
        p.next(); // generate_map
        const node = p.parseGenerateMap();
        if (p.peek()) throw new Error(`Linea ${idx + 1}: texto extra despues de generate_map(...).`);
        statements.push(node);
        continue;
      }

      // plotly.bar/line/pie/scatter(...).show()  -> bloque showInConsole
      if (tokens[0].t === "id" && tokens[0].v === "plotly") {
        const p = new Parser(tokens, vars);
        const node = p.parsePlotlyStatement();
        if (p.peek()) throw new Error(`Linea ${idx + 1}: texto extra despues de .show().`);
        statements.push(node);
        continue;
      }

      // Asignacion de columna derivada: df['x'] = ...  -> no hay bloque.
      if (
        tokens[0].t === "id" &&
        tokens[1] && tokens[1].t === "punc" && tokens[1].v === "[" &&
        tokens.some((t) => t.t === "op" && t.v === "=")
      ) {
        throw new Error(
          `Linea ${idx + 1}: crear columnas derivadas (df['x'] = ...) no tiene un bloque disponible.`
        );
      }

      // NAME = EXPR  (asignacion -> bloque variables_set, crea la variable)
      if (tokens[0].t === "id" && tokens[1] && tokens[1].t === "op" && tokens[1].v === "=") {
        const name = tokens[0].v;
        const p = new Parser(tokens, vars);
        p.next(); // name
        p.next(); // =
        const value = p.parseExpression();
        if (p.peek()) throw new Error(`Linea ${idx + 1}: texto extra en la asignacion.`);
        const id = String(nameToId(name));
        vars.set(name, id);
        statements.push({
          type: "variables_set",
          fields: { variableSetterKey: id },
          inputs: { VALUE: { block: value } },
        });
        continue;
      }

      throw new Error(`Linea ${idx + 1}: solo se soportan asignaciones, print(...) y generate_map(...).`);
    }

    if (statements.length === 0) {
      return { state: null, variables: [], error: "No hay nada para mostrar. Agrega al menos un print(...)." };
    }

    // encadenar sentencias con "next"
    for (let i = 0; i < statements.length - 1; i++) {
      statements[i].next = { block: statements[i + 1] };
    }
    const top = statements[0];
    resolveCsvRefs(top, csvsData, preferredCsvId);
    top.x = 20;
    top.y = 20;

    const variables = Array.from(vars, ([name, id]) => ({ id, name }));
    const state = { blocks: { languageVersion: 0, blocks: [top] } };
    return { state, variables, error: "" };
  } catch (e) {
    return { state: null, variables: [], error: e.message || "No se pudo convertir el codigo." };
  }
}

export default pythonToWorkspaceState;
