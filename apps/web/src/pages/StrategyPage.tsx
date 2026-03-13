import { useState } from "react";
import { callSaveStrategy } from "../firebase.js";

export function StrategyPage() {
  const [name, setName] = useState("default");
  const [paramsJson, setParamsJson] = useState("{}");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const r = await callSaveStrategy({ name, paramsJson });
      setMsg(`OK id: ${(r.data as { id?: string }).id}`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <>
      <h1>Strategy settings</h1>
      <div className="panel">
        <p>Запись только через <code>adminSaveStrategyConfig</code>.</p>
        <p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" />
        </p>
        <p>
          <textarea rows={8} value={paramsJson} onChange={(e) => setParamsJson(e.target.value)} />
        </p>
        <button type="button" disabled={busy} onClick={save}>
          Сохранить
        </button>
        <p>{msg}</p>
      </div>
    </>
  );
}
