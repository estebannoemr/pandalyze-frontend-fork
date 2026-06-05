import Blockly from "blockly";
import { pythonGenerator } from "blockly/python";

// Espejo de headBlock: .tail(n) devuelve las ultimas n filas.
export const initTailBlock = () => {
  Blockly.Blocks["tail"] = {
    init: function () {
      this.appendDummyInput().appendField("data_frame =");
      this.appendValueInput("VALUE").setCheck(null);
      this.appendDummyInput().appendField(".tail(");
      this.appendDummyInput().appendField(
        new Blockly.FieldTextInput("", this.validateInput),
        "argument"
      );
      this.appendDummyInput().appendField(")");
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour(10);
      this.setHelpUrl("");
    },

    validateInput: function (newValue) {
      if (/^\d+$/.test(newValue) && parseInt(newValue) > 0) {
        return newValue;
      } else {
        return "";
      }
    },
  };

  pythonGenerator["tail"] = function (block) {
    const blockInput = pythonGenerator.valueToCode(
      block,
      "VALUE",
      pythonGenerator.ORDER_NONE
    );
    const argumentInput = block.getFieldValue("argument");
    const tailCode = `${blockInput}.tail(${argumentInput})`;

    return [tailCode, pythonGenerator.ORDER_FUNCTION_CALL];
  };
};
