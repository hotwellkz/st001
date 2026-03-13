import { useState } from "react";
import { callSetKillSwitch } from "../firebase.js";

export function ControlsPage() {
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");

  async function setHalt(halt: boolean) {
    if (halt && confirm !== "HALT") {
      setMsg('Введите HALT для подтверждения');
      return;
    }
    setMsg("");
    try {
      await callSetKillSwitch({ halt });
      setMsg(halt ? "Emergency HALT включён" : "HALT снят");
    } catch (e: unknown) {
      setMsg(String(e));
    }
  }

  return (
    <>
      <h1>Manual controls</h1>
      <div className="panel">
        <p>
          <strong>Kill switch</strong> → Cloud Function <code>adminSetKillSwitch</code>
        </p>
        <p>
          <input
            placeholder="введите HALT для остановки"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </p>
        <p>
          <button type="button" className="danger" onClick={() => setHalt(true)}>
            Аварийная остановка
          </button>{" "}
          <button type="button" onClick={() => setHalt(false)}>
            Снять HALT
          </button>
        </p>
        <p>{msg}</p>
      </div>
    </>
  );
}
