import Blockly from "blockly";
import { pythonGenerator } from "blockly/python";

// Bloque encargado de tomar como input un bloque y si es un dataframe, listar sus columnas en un dropdown
export const initPropertyBlock = (csvsData, loadingExampleRef) => {
  /*
  Mapa que linkea el id del Example con la columna a mostrar 
   key: exampleId
   value: "columna" del example
  */
  const examplesMap = {
    1: "Superficie (km²)",
  };

  function getNewOptions(csvId) {
    // TODO: cambiar la función para evitar cambiarla constantemente?
    // creería que con sólo usar esta función, modificada para que la 
    // acepte el dropdown, ya alcanza. Los dropdown se evaluan cuando 
    // se despliega el menú.
    // Aunque, para obtener esta lista se podría hacer un bucle de dependencias
    // al momento de cargar el bloque. (?)
    const blockInputCsvColumnsNames = csvsData
      .find((csvData) => csvData.id.toString() === csvId)
      ?.columnsNames?.map((columnName) => [columnName, columnName]);

    return blockInputCsvColumnsNames;
  };

  function updateDropdown(block) {
    // TODO: cambiar la función para evitar cambiarla constantemente?
    const blockInput = block.getInputTargetBlock("blockInput");

    const csvId = findCsvId(blockInput);

    if (csvId) {
      const blockInputCsvColumnsNames = getNewOptions(csvId);

      // Si todavía no tenemos las columnas del CSV (csvsData no lo registró
      // aún o el id no coincide), dejamos el dropdown en estado neutro en
      // lugar de crashear al intentar leer [0][1] sobre undefined.
      if (!blockInputCsvColumnsNames || blockInputCsvColumnsNames.length === 0) {
        const dropdownField = block.getField("dropdown");
        dropdownField.menuGenerator_ = [["Columna", "Columna"]];
        dropdownField.setValue("Columna");
        return;
      }

      const currentOptions = block.getField("dropdown").getOptions();

      // Si cambiaron las opciones del dropdown, lo actualizo
      const optionsChanged =
        JSON.stringify(blockInputCsvColumnsNames) !==
        JSON.stringify(currentOptions);
      if (optionsChanged) {
        const dropdownField = block.getField("dropdown");
        dropdownField.menuGenerator_ = blockInputCsvColumnsNames;
        if (loadingExampleRef.current) {
          dropdownField.setValue(examplesMap[loadingExampleRef.current]); //columna del example
        } else {
          dropdownField.setValue(blockInputCsvColumnsNames[0][1]); //default: 1er columna humanReadable
        };
      };
      loadingExampleRef.current = undefined;
    } else {
      //Default si no ingresa bloque, o si el bloque no es de tipo dataframe
      const dropdownField = block.getField("dropdown");
      dropdownField.menuGenerator_ = [["Columna", "Columna"]];
      dropdownField.setValue("Columna");
    };
  };

  Blockly.Blocks["property"] = {
    init: function () {
      this.hidden_select = '';
      this.appendDummyInput().appendField("data_frame =");
      this.appendValueInput("blockInput").setCheck(null);
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown(this.generateOptions(this)),
        "dropdown"
      );
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour("#7D5A4B");
      this.setHelpUrl("");
    },

    generateOptions: function (block) {
      // TODO: cambiar la función para evitar cambiarla constantemente(?)
      const blockInput = block.getInputTargetBlock("blockInput");
      const csvId = findCsvId(blockInput);
      if (csvId) {
        const blockInputCsvColumnsNames = getNewOptions(csvId);
        if (blockInputCsvColumnsNames) {
          return blockInputCsvColumnsNames;
        } else {
          return [["Columna", "Columna"]];
        }
      }else{
        return [["Columna", "Columna"]];
      }
    },

    onchange: function (e) {
      // Actualizar opciones ignorando todos los eventos que no sean relevantes.
      if (
        e.type === Blockly.Events.BLOCK_MOVE ||
        e.type === Blockly.Events.BLOCK_CHANGE
      ) {
        updateDropdown(this);
      };

      // Actualizar opciones y restaurar el valor seleccionado.
      if (e.type == Blockly.Events.FINISHED_LOADING) {
        updateDropdown(this);
        try {this.getField('dropdown').setValue(this.hidden_select);}
        catch (e) {};
      }
    },

    saveExtraState: function () {
      // guardar el valor seleccionado.
      return {
        selectedOption: this.getField('dropdown').getValue()
      }
    },

    loadExtraState: function (state) {
      // cargar el valor seleccionado en una variable auxiliar.
      // evita problemas con el orden de cargado.
      this.hidden_select = state.selectedOption;
    }
  };

  pythonGenerator["property"] = function (block) {
    var blockInputCode = pythonGenerator.valueToCode(
      block,
      "blockInput",
      pythonGenerator.ORDER_NONE
    );
    var dropdownInput = block.getFieldValue("dropdown");
    var propertyCode = `${blockInputCode}["${dropdownInput}"]`;

    return [propertyCode, pythonGenerator.ORDER_FUNCTION_CALL];
  };

  // Función principal para encontrar el csvOptions de un bloque dado
  function findCsvId(blockInput) {
    if (!blockInput) {
      return null;
    };

    // Verificar si el bloque de entrada es un 'read_csv'
    if (blockInput.type === "read_csv") {
      return blockInput.getFieldValue("csvOptions");
    };

    // Función interna para buscar recursivamente el 'read_csv'
    function recursiveFindCsvId(block) {
      // Obtener el nombre de la variable del bloque de entrada (si es que 'block' es un variables_set)
      const variableName = block.getField("variableGetterKey")?.getText();

      if (variableName) {
        // Si es una variable, buscar el bloque que la setea
        const setterBlock = findSetterBlock(variableName);

        if (setterBlock) {
          // Si se encontró el setter, buscar 'read_csv' dentro de su valor
          const valueBlock = setterBlock.getInputTargetBlock("VALUE");

          if (valueBlock) {
            const csvId =
              findReadCsvBlock(valueBlock)?.getFieldValue("csvOptions");

            // Devolver el csvId encontrado, o hacer recursion
            return csvId ? csvId : recursiveFindCsvId(valueBlock);
          };
        };
      };

      // Si no es una variable, buscar recursivamente en los bloques hijos
      const connectedBlocks = block.getChildren();
      for (let i = 0; i < connectedBlocks.length; i++) {
        const csvId = recursiveFindCsvId(connectedBlocks[i]);
        if (csvId) {
          return csvId;
        };
      };

      return null; // Devolver null si no se encontraron opciones de 'csv'
    };

    // Llamar a la función interna para buscar recursivamente
    return recursiveFindCsvId(blockInput);
  };

  // Función recursiva para encontrar el bloque 'read_csv' dentro del parametro 'block'
  function findReadCsvBlock(block) {
    // Caso base: el bloque actual es 'read_csv'
    if (block.type === "read_csv") {
      return block; // Devolver el bloque 'read_csv' encontrado
    };

    // Obtener todos los bloques conectados
    const connectedBlocks = block.getChildren();

    // Recorrer recursivamente los bloques conectados
    for (let i = 0; i < connectedBlocks.length; i++) {
      const foundBlock = findReadCsvBlock(connectedBlocks[i]);
      if (foundBlock) {
        return foundBlock; // Devolver el bloque 'read_csv' encontrado
      };
    };

    return null; // Devolver null si no se encuentra ningún bloque 'read_csv'
  };

  // Función para encontrar el bloque 'variables_set' que setea una variable específica
  function findSetterBlock(variableName) {
    return Blockly.getMainWorkspace()
      .getAllBlocks()
      .find((block) => {
        return block.getField("variableSetterKey")?.getText() === variableName;
      });
  };
};
