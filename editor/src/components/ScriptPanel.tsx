// Panneau script : le bytecode de la scène en syntaxe assembleur datagen.

interface Props {
  script: string[];
  onChange: (script: string[]) => void;
}

export default function ScriptPanel({ script, onChange }: Props) {
  return (
    <div className="panel">
      <div className="panel-title">Script de la scène</div>
      <textarea
        className="script-edit"
        rows={18}
        spellCheck={false}
        value={script.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
      />
      <p className="hint">
        Un opcode par ligne, <code>label:</code> pour les cibles, <code>;</code>{" "}
        commentaire. Opcodes : END, MSG &lt;texte&gt;, SETVAR/ADDVAR v&lt;n&gt;
        &lt;val&gt;, SETGVAR g&lt;n&gt; &lt;val&gt;, JMP &lt;label&gt;,
        JEQ/JNE/JGEQ v&lt;n&gt; &lt;val&gt; &lt;label&gt;. Les PNJ pointent sur
        un label via leur champ « Script ».
      </p>
    </div>
  );
}
