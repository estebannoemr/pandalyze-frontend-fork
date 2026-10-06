import React from "react";

// Los textos de los desafíos (consigna, instrucciones, pista, mensajes)
// marcan los nombres de bloques, métodos y valores entre dos acentos graves a
// cada lado, por ejemplo: Usá el bloque ``shape``. Esta función convierte
// esos tramos en <code>, para que se vean en letra de código y sin los
// símbolos. El resto del texto queda igual. También acepta un solo acento
// grave a cada lado (`shape`).
export function formatText(text) {
  if (typeof text !== "string" || text.indexOf("`") === -1) return text;
  const parts = text.split(/(``[^`]+``|`[^`]+`)/g);
  return parts.map((part, idx) => {
    const m = /^(``|`)([^`]+)\1$/.exec(part);
    if (m) {
      return (
        <code key={idx} className="challenge-inline-code">
          {m[2]}
        </code>
      );
    }
    return part;
  });
}

export default formatText;
