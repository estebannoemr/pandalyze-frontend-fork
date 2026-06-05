export const toolbox = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Variables",
      custom: "VariablesCategory",
      colour: "#B48AE6",
      contents: [
        {
          kind: "button",
          text: "Crear variable",
          callbackKey: "createVariableCallbackKey",
        },
      ],
    },
    {
      kind: "category",
      name: "Literales",
      colour: "#4B168B",
      contents: [
        {
          kind: "block",
          type: "primitive_number",
        },
        {
          kind: "block",
          type: "primitive_text",
        },
        {
          kind: "block",
          type: "primitive_boolean",
        },
      ],
    },
    {
      kind: "sep",
      gap: "8",
    },
    {
      kind: "category",
      name: "Pandas",
      colour: "#D19C77",
      contents: [
        {
          kind: "category",
          name: "Acceso a datos",
          colour: "#CD853F",
          contents: [
            {
              kind: "block",
              type: "read_csv",
            },
            {
              kind: "block",
              type: "values",
            },
            {
              kind: "block",
              type: "index",
            },
            {
              kind: "block",
              type: "get_column_name", 
            },
          ],
        },
        {
          kind: "category",
          name: "Información",
          colour: "10",
          contents: [
            {
              kind: "block",
              type: "head",
            },
            {
              kind: "block",
              type: "tail",
            },
            {
              kind: "block",
              type: "info",
            },
            {
              kind: "block",
              type: "describe",
            },
            {
              kind: "block",
              type: "dtypes",
            },
            {
              kind: "block",
              type: "column",
            },
            {
              kind: "block",
              type: "shape",
            },
            {
              kind: "block",
              type: "unique",
            },
          ],
        },
        {
          kind: "category",
          name: "Cálculos",
          colour: "#800000",
          contents: [
            {
              kind: "block",
              type: "count",
            },
            {
              kind: "block",
              type: "max",
            },
            {
              kind: "block",
              type: "min",
            },
            {
              kind: "block",
              type: "mean",
            },
            {
              kind: "block",
              type: "nullSum",
            },
            {
              kind: "block",
              type: "sum",
            },
            {
              kind: "block",
              type: "valueCounts",
            },
          ],
        },
        {
          kind: "category",
          name: "Filtros",
          colour: "#7D5A4B",
          contents: [
            {
              kind: "block",
              type: "comparison",
            },

            {
              kind: "block",
              type: "property",
            },
          ],
        },
        {
          kind: "category",
          name: "Distribución",
          colour: "#000000",
          contents: [
            {
              kind: "block",
              type: "sort",
            },
            {
              kind: "block",
              type: "groupby",
            },
          ],
        },
      ],
    },
    {
      kind: "sep",
      gap: "8",
    },
    {
      kind: "category",
      name: "Plotly",
      colour: "80",
      contents: [
        {
          kind: "block",
          type: "line",
        },
        {
          kind: "block",
          type: "bar",
        },
        {
          kind: "block",
          type: "scatter",
        },
        {
          kind: "block",
          type: "pie",
        },
      ],
    },
    {
      kind: "sep",
      gap: "8",
    },
    {
      kind: "category",
      name: "Mapas",      
      colour: "#5B80A5",  
      contents: [
        {
          kind: "block",
          type: "map_viewer", 
        },
      ],
    },
    {
      kind: "sep",
      gap: "8",
    },
 {
      kind: "category",
      name: "Salida",
      colour: "150",
      contents: [
        {
          kind: "block",
          type: "print_with_argument",
        },
        {
          kind: "block",
          type: "showInConsole",
        },
      ],
    },
  ],
};