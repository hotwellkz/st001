import { useState } from "react";
import { callSetTradingMode } from "../firebase.js";

export function TradingModePage() {
  const [msg, setMsg] = useState("");
  const [ack, setAck] = useState(false);

  async function setMode(mode: "paper" | "live") {
    setMsg("");
    try {
      await callSetTradingMode({ mode, ackLive: mode === "live" ? ack : false });
      setMsg(`Режим записан: ${mode} (engine должен читать Firestore + LIVE_TRADING_ENABLED)`);
    } catch (e: unknown) {
      setMsg(String(e));
    }
  }

  return (
    <>
      <h1>Paper / Live</h1>
      <div className="panel">
        <p>
          Запись режима в <code>users/{'{uid}'}</code> через Function. Live на бирже только если engine
          с <code>LIVE_TRADING_ENABLED</code>.
        </p>
        <p>
          <label>
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Я
            понимаю риск live
          </label>
        </p>
        <button type="button" onClick={() => setMode("paper")}>
          Paper
        </button>{" "}
        <button type="button" className="danger" onClick={() => setMode("live")}>
          Live (подтверждение)
        </button>
        <p>{msg}</p>
      </div>
    </>
  );
}
