import Blockly from "blockly";
import { pythonGenerator } from "blockly/python";

// groupby con dropdown dinámico: las opciones se sincronizan con las columnas
// del DataFrame conectado al input "DATAFRAME". Misma lógica que propertyBlock,
// duplicada acá a propósito para mantener cada bloque autocontenido.
export const initGroupByBlock = (csvsData, loadingExampleRef) => {
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

  function setNeutralDropdown(block) {
    const f = block.getField("groupbyColumn");
    if (!f) return;
    f.menuGenerator_ = [["Columna", "Columna"]];
    f.setValue("Columna");
  }

  function updateDropdown(block) {
    const dfInput = block.getInputTargetBlock("DATAFRAME");
    const csvId = findCsvId(dfInput);

    if (!csvId) {
      setNeutralDropdown(block);
      return;
    }

    const opts = getNewOptions(csvId);
    if (!opts || opts.length === 0) {
      setNeutralDropdown(block);
      return;
    }

    const f = block.getField("groupbyColumn");
    const current = f.getOptions();
    if (JSON.stringify(opts) !== JSON.stringify(current)) {
      f.menuGenerator_ = opts;
      f.setValue(opts[0][1]);
    }
  }

  Blockly.Blocks["groupby"] = {
    init: function () {
      this.hidden_select = "";
      this.appendValueInput("DATAFRAME")
        .setCheck(null)
        .appendField("data_frame = ");
      this.appendDummyInput()
        .appendField(".groupby(columna = ")
        .appendField(
          new Blockly.FieldDropdown([["Columna", "Columna"]]),
          "groupbyColumn"
        )
        .appendField(")");
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour("#000000");
      this.setHelpUrl("");
    },

    onchange: function (e) {
      if (
        e.type === Blockly.Events.BLOCK_MOVE ||
        e.type === Blockly.Events.BLOCK_CHANGE
      ) {
        updateDropdown(this);
      }
      if (e.type === Blockly.Events.FINISHED_LOADING) {
        updateDropdown(this);
        try {
          this.getField("groupbyColumn").setValue(this.hidden_select);
        } catch (_) {}
      }
    },

    saveExtraState: function () {
      return { selectedOption: this.getField("groupbyColumn").getValue() };
    },

    loadExtraState: function (state) {
      this.hidden_select = state?.selectedOption || "";
    },
  };

  pythonGenerator["groupby"] = function (block) {
    const dataframeInput =
      pythonGenerator.valueToCode(
        block,
        "DATAFRAME",
        pythonGenerator.ORDER_NONE
      ) || "";
    const col = block.getFieldValue("groupbyColumn") || "Columna";
    const groupbyCode = `${dataframeInput}.groupby("${col}")`;
    return [groupbyCode, pythonGenerator.ORDER_FUNCTION_CALL];
  };
};
