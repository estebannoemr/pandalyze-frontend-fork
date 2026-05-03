import Blockly from "blockly";
import { toolbox } from "../constants/toolbox";
import { initHeadBlock } from "../constants/blocks/headBlock";
import { initInfoBlock } from "../constants/blocks/infoBlock";
import { initColumnBlock } from "../constants/blocks/columnBlock";
import { initShapeBlock } from "../constants/blocks/shapeBlock";
import { initDataTypeBlock } from "../constants/blocks/dataTypeBlock";
import { initPrintBlock } from "../constants/blocks/printBlock";
import { initReadCsvBlock } from "../constants/blocks/readCsvBlock";
import { initVariablesBlocks } from "../constants/blocks/variablesBlock";
import { initPropertyBlock } from "../constants/blocks/propertyBlock";
import { initComparisonBlock } from "../constants/blocks/comparisonBlock";
import { initDescribeBlock } from "../constants/blocks/describeBlock";
import { initPrimitiveBlocks } from "../constants/blocks/primitiveBlocks";
import { initSortBlock } from "../constants/blocks/sortBlock";
import { initValuesBlock } from "../constants/blocks/valueBlock";
import { initIndexBlock } from "../constants/blocks/indexBlock";
import { initMeanBlock } from "../constants/blocks/pandasFilter/meanBlock";
import { initMaxBlock } from "../constants/blocks/pandasFilter/maxBlock";
import { initMinBlock } from "../constants/blocks/pandasFilter/minBlock";
import { initCountBlock } from "../constants/blocks/pandasFilter/countBlock";
import { initNullSumBlock } from "../constants/blocks/pandasFilter/nullColumnCounterBlock";
import { initUniqueBlock } from "../constants/blocks/pandasFilter/uniqueBlock";
import { initGroupByBlock } from "../constants/blocks/pandasFilter/groupbyBlock";
import { initSumBlock } from "../constants/blocks/pandasFilter/sumBlock";
import { initValueCountsBlock } from "../constants/blocks/pandasFilter/valueCountsBlocks";
import { initLineBlock } from "../constants/blocks/plotly/lineBlock";
import { initMapViewerBlock } from "../constants/blocks/maps/mapBlock";
import { initScatterBlock } from "../constants/blocks/plotly/scatterBlock";
import { initBarBlock } from "../constants/blocks/plotly/barBlock";
import { initPieBlock } from "../constants/blocks/plotly/pieBlock";
import { initShowInConsoleBlock } from "../constants/blocks/plotly/showInConsoleBlock";
import { initColumnNameBlock } from '../constants/blocks/columnNameBlock';
import defaultBlocks from "../constants/blocks/defaultBlocks.json";

const BlocksService = {
  variables: [],
  csvsData: [],
  // Mapa csv_id (string) -> contenido CSV (string). Sólo se llena cuando
  // un dataset se cargó "inline" (sin pasar por /uploadCsv) — típicamente
  // para los CSVs de desafíos, que viven exclusivamente en el cliente.
  // PythonEditor lo serializa y lo manda en cada /runPythonCode para que
  // el backend pueda resolver read_csv(csv_id) sin tocar la DB.
  inlineCsvs: {},

  initBlocks(useFrontRef, loadingExampleRef) {
    initPrintBlock();
    initReadCsvBlock(useFrontRef);
    initHeadBlock();
    initInfoBlock();
    initColumnBlock();
    initShapeBlock();
    initDataTypeBlock();
    initDescribeBlock();
    initVariablesBlocks();
    initPropertyBlock(this.csvsData, loadingExampleRef);
    initLineBlock();
    initMapViewerBlock(this.csvsData, loadingExampleRef);
    initBarBlock();
    initScatterBlock();
    initPieBlock();
    initMeanBlock();
    initMaxBlock();
    initMinBlock();
    initCountBlock();
    initNullSumBlock();
    initUniqueBlock();
    initSortBlock();
    initComparisonBlock();
    initPrimitiveBlocks();
    initShowInConsoleBlock(useFrontRef);
    initGroupByBlock(this.csvsData, loadingExampleRef);
    initSumBlock();
    initValueCountsBlock();
    initValuesBlock();
    initIndexBlock();
    initColumnNameBlock();
  },

  mapCsvs() {
    var ret = [["Cargando...", "1"]];

    if (this.csvsData) {
      ret = this.csvsData.map((csvData) => [
        csvData.filename,
        `${csvData.id}`,
      ]);
    }

    return ret
  },

  // Se dispara cuando el usuario guarda un Csv
  // autoAdd: si es true, crea un bloque read_csv en el workspace automáticamente
  onCsvUpload(csvData, autoAdd = false) {
    if (csvData) {
      this.csvsData.push(csvData);
      if (autoAdd) {
        this.addReadCsvBlockToWorkspace();
      }
    }
  },

  // Registra un CSV "inline" — ya descargado en el cliente — sin subirlo al
  // backend. El csv_id debe ser único; típicamente lo armamos con
  // ``BlocksService.nameToId(filename)`` para que sea determinístico y
  // sobreviva a recargas del workspace. Si ya existe un csvData con ese
  // id (por ejemplo, otro desafío con el mismo filename) lo reemplazamos.
  registerInlineCsv({ id, filename, content, columnsNames }, autoAdd = true) {
    if (id == null || !filename || typeof content !== "string") return;
    const idStr = String(id);
    // Evitar duplicar entradas en csvsData con el mismo id.
    // IMPORTANTE: mutamos el array in-place (no reasignamos con filter) porque
    // propertyBlock.js recibió esta misma referencia al inicializarse. Si la
    // reemplazamos, el dropdown del bloque "property" queda apuntando al array
    // viejo y no ve los CSVs inline registrados después.
    for (let i = this.csvsData.length - 1; i >= 0; i--) {
      if (String(this.csvsData[i].id) === idStr) {
        this.csvsData.splice(i, 1);
      }
    }
    this.csvsData.push({
      id,
      filename,
      columnsNames: columnsNames || [],
    });
    this.inlineCsvs[idStr] = content;
    if (autoAdd) {
      this.addReadCsvBlockToWorkspace();
    }
  },

  // Quita un CSV inline tanto del dropdown como del mapa de contenidos.
  // Útil cuando se cierra/desinscribe un desafío.
  unregisterInlineCsv(id) {
    if (id == null) return;
    const idStr = String(id);
    // Mutación in-place — ver comentario en registerInlineCsv.
    for (let i = this.csvsData.length - 1; i >= 0; i--) {
      if (String(this.csvsData[i].id) === idStr) {
        this.csvsData.splice(i, 1);
      }
    }
    delete this.inlineCsvs[idStr];
  },

  // Devuelve el dict serializable que PythonEditor adjunta a cada
  // /runPythonCode. Sólo incluye los CSVs inline que actualmente están
  // referenciados por algún bloque read_csv del workspace, para no inflar
  // requests con datasets que ya no se usan.
  getInlineCsvsForRun() {
    if (!this.inlineCsvs || Object.keys(this.inlineCsvs).length === 0) {
      return {};
    }
    let inUseIds = null;
    try {
      const ws = Blockly.getMainWorkspace && Blockly.getMainWorkspace();
      if (ws) {
        inUseIds = new Set(
          ws.getBlocksByType("read_csv").map((b) => {
            const f = b.getField && b.getField("csvOptions");
            return f ? String(f.getValue()) : null;
          }).filter(Boolean)
        );
      }
    } catch (_) {
      inUseIds = null;
    }
    const out = {};
    Object.keys(this.inlineCsvs).forEach((idStr) => {
      if (inUseIds == null || inUseIds.has(idStr)) {
        out[idStr] = this.inlineCsvs[idStr];
      }
    });
    return out;
  },

  addReadCsvBlockToWorkspace() {
    const workspace = Blockly.getMainWorkspace();
    if (!workspace) return;

    const block = workspace.newBlock("read_csv");
    block.initSvg();
    block.render();

    // Posicionar en un lugar visible del workspace
    const metrics = workspace.getMetrics();
    block.moveBy(
      metrics ? metrics.viewLeft + 20 : 20,
      metrics ? metrics.viewTop + 20 : 20
    );
  },

  replaceWorkspaceWithReadCsvBlock(csvId) {
    const workspace = Blockly.getMainWorkspace();
    if (!workspace) return;

    workspace.clear();

    const block = workspace.newBlock("read_csv");
    if (csvId != null) {
      block.setFieldValue(String(csvId), "csvOptions");
    }
    block.initSvg();
    block.render();

    const metrics = workspace.getMetrics();
    block.moveBy(
      metrics ? metrics.viewLeft + 20 : 20,
      metrics ? metrics.viewTop + 20 : 20
    );
  },

  onRefreshFlyout() {
    if (this.variables.length === 0) {
      return [
        {
          kind: "button",
          text: "Crear variable",
          callbackKey: "createVariableCallbackKey",
        },
      ];
    } else {
      return [
        {
          kind: "button",
          text: "Crear variable",
          callbackKey: "createVariableCallbackKey",
        },
        {
          kind: "block",
          type: "variables_get",
        },
        {
          kind: "block",
          type: "variables_set",
        },
      ];
    }
  },

  loadWorkspace(workspace) {
    // Guardar el workspace para cargarlo de nuevo en caso de error.
    const backupWorkspace = this.getCurrentWorkspace();
    var ret = '';

    try {
      // agregar variables guardadas en el workspace evitando duplicados.
      this.variables = [...this.variables, ...workspace.variables].filter(
        (v, i, arr) => arr.findIndex(o => o.id === v.id) === i
      );
      this.updateVariablesDrowdown();

      // sobreescribir el workspace de blockly.
      // puede fallar si se modificó el contenido. por ejemplo intentando poner
      // un nombre de un bloque que no existe.
      Blockly.serialization.workspaces.load(
        workspace.blocks, 
        Blockly.getMainWorkspace()
      );

      // no falló nada.
    } catch(e) {
      // falló cargar el archivo leído.
      // TODO: ver si esta recursión genera problemas. creería que no(?)
      this.loadWorkspace(backupWorkspace);
      ret = 'Hay un error en el archivo por lo que no puede ser cargado.';
    };

    return ret;
  },

  updateVariablesDrowdown() {
    // Actualizar las opciones de los bloques get y set
    Blockly.Blocks["variables_get"].generateOptions = function () {
      return BlocksService.variables.map(v => [v.name, v.id]);
    };

    Blockly.Blocks["variables_set"].generateOptions = function () {
      return BlocksService.variables.map(v => [v.name, v.id]);
    };
  },

  getCurrentWorkspace() {
    // Devolver el workspace actual.

    const getCsvFilesInUse = () => {
      // Obtener los nombres de los archivos csv que están seleccionados en los
      // bloques csv.
      // TODO: como se mantiene el id de los csv quizá esta solución no es la 
      // correcta. Pero todo depende de qué es el id de los csv y cómo se genera.
      // Parece que los id se usan para elegir cual csv usar en los bloques de csv
      // asi que se tienen que mantener. Pero no sé si son únicos para cada csv aún.
      const csvNames = Blockly.getMainWorkspace().getBlocksByType("read_csv").map(
        b => b.getField("csvOptions").getText()
      );
      // Retornar toda la info de los csv que se están usando.
      // Se rompe si se repite??? no creo pero considerable.
      return this.csvsData.filter(c => csvNames.includes(c.filename))
    };

    return {
      variables: this.variables,
      csvsData: getCsvFilesInUse(),
      blocks: Blockly.serialization.workspaces.save(Blockly.getMainWorkspace())
    };
  },

  loadDefaultWorkspace(force) {
    // función de carga del workspace predeterminado.
    // force: boolean; true: saltea el check de variables/csv, false: no saltea.
    return force ? this.loadWorkspace(defaultBlocks) : this.onWorkspaceLoad(defaultBlocks);
  },

  onWorkspaceLoad(workspace) {
    // Se ejecuta cuando se quiere cargar un workspace. 
    // Verifica que no falten CSV y carga las variables junto al workspace de Blockly.

    // verificar que los csv del workspace cargado esten cargados.
    // (true si newCsvsData está "incluido" en this.csvsData, false sino).
    const missingCsvs = workspace.csvsData.filter(
      c1 => !this.csvsData.some(
        c2 => JSON.stringify(c1) == JSON.stringify(c2)
      )
    );

    // TODO: de esta forma el orden en que se cargan los csv importa? como se usa el 
    // id para elegir el csv creo que no interesa el orden.
    // TODO: implementar una solución donde el orden de carga no importe? 
    // (aunque sí importa para otras cosas asi que podría ser mejor dejarlo así 
    // y aclarar que importa en un cartel)
    if (missingCsvs.length == 0) {
      const response = this.loadWorkspace(workspace);
      return response;
    } else {
      // faltan cargar archivos csv usados en la solución.
      const missingNames = missingCsvs.map(c => c.filename).join(", ");
      return `Asegúrese de cargar los archivos CSV que usó anteriormente (${missingNames}) e intente nuevamente.`;
    };
  },

  isValidVariable(name) {
    if (typeof name !== "string") {
      return "El nombre de la variable debe ser un string."
    };
  
    // el patrón también lo verifica
    if (name?.trim() === "") {
      return "El nombre de la variable no puede estar vacío.";
    };
  
    // el patrón también lo verifica
    if (name?.includes(" ")) {
      return "El nombre de la variable no puede contener espacios.";
    };
  
    if (this.variables?.some(v => v.name === name)) {
      return "La variable ya existe.";
    };
  
    // patrón para verificar primer caracter letra minus. o mayus. o guión bajo
    // y el resto sólo letras minus. o mayus., número o guión bajo. además no
    // puede haber guiones dobles.
    const pattern = /^(?!.*__)[A-Za-z_][A-Za-z0-9_]*$/;
  
    if (!pattern.test(name)) {
      return "El nombre de la variable sólo puede contener letras minúsculas, mayúsculas y números"
    };
  
    const pythonKeywords = new Set([
      "False","None","True","and","as","assert","async","await",
      "break","class","continue","def","del","elif","else","except",
      "finally","for","from","global","if","import","in","is",
      "lambda","nonlocal","not","or","pass","raise","return",
      "try","while","with","yield"
    ]);
  
    if (pythonKeywords.has(name)) {
      return "El nombre de la variable no puede ser una de las palabras reservadas de Python. Te invitamos a investigarlas!"
    };
  
    return "";
  },

  nameToId (name, h = 5381) {
    // Generar ID a partir de un string utilizando DJB2.
    // Retorna un número entero positivo de 32 bits.
    for (let i = 0; i < name.length; i++) {
      h = (h * 33) ^ name.charCodeAt(i);
    }
    return (h >>> 0).toString();
  },

  onCreateVariableClick(button) {
    const variableName = prompt("Nombra tu variable:");

    const ret = this.isValidVariable(variableName);

    if (!ret) {
      this.variables.push({
        id: this.nameToId(variableName),
        name: variableName,
      });
      console.log(JSON.stringify(this.variables))

      this.updateVariablesDrowdown();

      if (this.variables.length === 1) {
        // Actualizar la flyout en el workspace
        const flyout = Blockly.getMainWorkspace().getFlyout();
        flyout.hide();
        flyout.show(toolbox);
      };
    }

    return ret;
  },
};

export default BlocksService;
