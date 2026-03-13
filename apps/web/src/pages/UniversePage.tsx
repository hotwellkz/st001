import { useState } from "react";
import { callSaveUniverse } from "../firebase.js";

export function UniversePage() {
  const [name, setName] = useState("default");
  const [symbolsText, setSymbolsText] = useState("BTCUSDT,ETHUSDT");
  const [msg, setMsg] = useState("");

  async function save() {
    setMsg("");
    try {
      const symbols = symbolsText.split(",").map((s) => s.trim()).filter(Boolean);
      await callSaveUniverse({ name, symbols });
      setMsg("OK");
    } catch (e: unknown) {
      setMsg(String(e));
    }
  }

  return (
    <>
      <h1>Universe</h1>
      <div className="panel">
        <p>Через <code>adminSaveUniverse</code>.</p>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <p>
          <textarea rows={4} value={symbolsText} onChange={(e) => setSymbolsText(e.target.value)} />
        </p>
        <button type="button" onClick={save}>
          Сохранить
        </button>
        <p>{msg}</p>
      </div>
    </>
  );
}
