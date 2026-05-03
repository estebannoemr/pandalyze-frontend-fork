import Blockly from "blockly";
import { pythonGenerator } from "blockly/python";

// map_viewer con 3 dropdowns dinámicos (LAT, LONG, CATEGORY) sincronizados con
// las columnas del DataFrame conectado al input "DATAFRAME". Misma lógica que
// propertyBlock/groupbyBlock, autocontenida.
export const initMapViewerBlock = (csvsData, loadingExampleRef) => {
  function getNewOptions(csvId) {
    return csvsData
      .find((c) => c.id.toString() === csvId)
      ?.columnsNames?.map((name) => [name, name]);
  }

  function findReadCsv(block) {
    if (!block) return null;
    if (block.type === "read_csv") return block;
    for (const child of block.getChildren()) {
      const found = findReadCsv(child);
      if (found) return found;
    }
    return null;
  }

  function findSetterBlock(variableName) {
    return Blockly.getMainWorkspace()
      .getAllBlocks()
      .find((b) => b.getField("variableSetterKey")?.getText() === variableName);
  }

  function findCsvId(blockInput) {
    if (!blockInput) return null;
    if (blockInput.type === "read_csv") return blockInput.getFieldValue("csvOptions");

    function recursive(block) {
      const variableName = block.getField("variableGetterKey")?.getText();
      if (variableName) {
        const setter = findSetterBlock(variableName);
        if (setter) {
          const valueBlock = setter.getInputTargetBlock("VALUE");
          if (valueBlock) {
            const csvId = findReadCsv(valueBlock)?.getFieldValue("csvOptions");
            return csvId ? csvId : recursive(valueBlock);
          }
        }
      }
      for (const child of block.getChildren()) {
        const id = recursive(child);
        if (id) return id;
      }
      return null;
    }
    return recursive(blockInput);
  }

  const FIELDS = ["latColumn", "longColumn", "categoryColumn"];

  function setNeutralAll(block) {
    FIELDS.forEach((fieldName) => {
      const f = block.getField(fieldName);
      if (!f) return;
      f.menuGenerator_ = [["Columna", "Columna"]];
      f.setValue("Columna");
    });
  }

  function updateDropdowns(block) {
    const dfInput = block.getInputTargetBlock("DATAFRAME");
    const csvId = findCsvId(dfInput);

    if (!csvId) {
      setNeutralAll(block);
      return;
    }

    const opts = getNewOptions(csvId);
    if (!opts || opts.length === 0) {
      setNeutralAll(block);
      return;
    }

    FIELDS.forEach((fieldName) => {
      const f = block.getField(fieldName);
      if (!f) return;
      const current = f.getOptions();
      if (JSON.stringify(opts) !== JSON.stringify(current)) {
        f.menuGenerator_ = opts;
        // Conservar el valor previo si todavía existe entre las nuevas opciones.
        const prev = f.getValue();
        const stillValid = opts.some(([, v]) => v === prev);
        if (!stillValid) {
          f.setValue(opts[0][1]);
        }
      }
    });
  }

  Blockly.Blocks["map_viewer"] = {
    init: function () {
      this.hidden_select = { lat: "", long: "", category: "" };
      this.appendValueInput("DATAFRAME").setCheck(null).appendField("mostrar mapa de:");
      this.appendDummyInput()
        .appendField("usar lat:")
        .appendField(
          new Blockly.FieldDropdown([["Columna", "Columna"]]),
          "latColumn"
        );
      this.appendDummyInput()
        .appendField("usar long:")
        .appendField(
          new Blockly.FieldDropdown([["Columna", "Columna"]]),
          "longColumn"
        );
      this.appendDummyInput()
        .appendField("por categoría:")
        .appendField(
          new Blockly.FieldDropdown([["Columna", "Columna"]]),
          "categoryColumn"
        );
      this.setInputsInline(false);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip(
        "Genera un mapa a partir de un DataFrame. Elegi las columnas de latitud, longitud y categoría desde los menus."
      );
    },

    onchange: function (e) {
      if (
        e.type === Blockly.Events.BLOCK_MOVE ||
        e.type === Blockly.Events.BLOCK_CHANGE
      ) {
        updateDropdowns(this);
      }
      if (e.type === Blockly.Events.FINISHED_LOADING) {
        updateDropdowns(this);
        try {
          if (this.hidden_select.lat) this.getField("latColumn").setValue(this.hidden_select.lat);
          if (this.hidden_select.long) this.getField("longColumn").setValue(this.hidden_select.long);
          if (this.hidden_select.category) this.getField("categoryColumn").setValue(this.hidden_select.category);
        } catch (_) {}
      }
    },

    saveExtraState: function () {
      return {
        lat: this.getField("latColumn")?.getValue() || "",
        long: this.getField("longColumn")?.getValue() || "",
        category: this.getField("categoryColumn")?.getValue() || "",
      };
    },

    loadExtraState: function (state) {
      this.hidden_select = {
        lat: state?.lat || "",
        long: state?.long || "",
        category: state?.category || "",
      };
    },
  };

  pythonGenerator["map_viewer"] = function (block) {
    const dataframe =
      pythonGenerator.valueToCode(block, "DATAFRAME", pythonGenerator.ORDER_ATOMIC) ||
      "None";
    const lat = block.getFieldValue("latColumn") || "Columna";
    const long = block.getFieldValue("longColumn") || "Columna";
    const category = block.getFieldValue("categoryColumn") || "Columna";

    return `generate_map(dataframe=${dataframe}, lat_col='${lat}', long_col='${long}', category_col='${category}')\n`;
  };
};
