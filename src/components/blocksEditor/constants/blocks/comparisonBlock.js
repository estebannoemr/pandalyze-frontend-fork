import Blockly from "blockly";
import { pythonGenerator } from "blockly/python";

export const initComparisonBlock = () => {
  Blockly.Blocks["comparison"] = {
    init: function () {
      this.appendDummyInput().appendField("data_frame =");
      this.appendValueInput("dataFrameValue").setCheck(null);
      this.appendDummyInput().appendField("[");
      this.appendDummyInput().appendField("columna =");
      this.appendValueInput("columnNameValue").setCheck(null);
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["==", "EQUAL"],
          [">", "GREATER_THAN"],
          ["<", "LESS_THAN"],
          [">=", "GREATER_THAN_OR_EQUAL"],
          ["<=", "LESS_THAN_OR_EQUAL"],
          ["!=", "NOT_EQUAL"],
        ]),
        "OPERATOR"
      );
      this.appendValueInput("rightValue").setCheck(null);
      this.appendDummyInput().appendField("]");
      this.setInputsInline(true);
      this.setOutput(true, "Boolean");
      this.setColour("#7D5A4B");
    },
  };

  pythonGenerator["comparison"] = function (block) {
    var dataFrameValue = pythonGenerator.valueToCode(
      block,
      "dataFrameValue",
      pythonGenerator.ORDER_NONE
    );
    var columnNameValue =
      pythonGenerator.valueToCode(
        block,
        "columnNameValue",
        pythonGenerator.ORDER_NONE
      ) || 0;
    var operator = block.getField("OPERATOR").getText();
    var rightValue =
      pythonGenerator.valueToCode(
        block,
        "rightValue",
        pythonGenerator.ORDER_NONE
      ) || 0;
    // var comparisonCode = `${dataFrameValue}[${columnNameValue} ${operator} ${rightValue}]`;
    var comparisonCode = `${dataFrameValue}[${dataFrameValue}[${columnNameValue}] ${operator} ${rightValue}]`;

    return [comparisonCode, pythonGenerator.ORDER_FUNCTION_CALL];
  };
};
