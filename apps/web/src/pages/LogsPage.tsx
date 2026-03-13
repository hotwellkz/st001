import { collection, getDocs, limit, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase.js";

export function LogsPage() {
  const [alerts, setAlerts] = useState<{ id: string; data: Record<string, unknown> }[]>([]);
  const [audit, setAudit] = useState<{ id: string; data: Record<string, unknown> }[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    getDocs(query(collection(db, "alerts"), limit(50)))
      .then((s) => setAlerts(s.docs.map((d) => ({ id: d.id, data: d.data() }))))
      .catch((e) => setErr(String(e)));
    getDocs(query(collection(db, "auditLog"), limit(80)))
      .then((s) => setAudit(s.docs.map((d) => ({ id: d.id, data: d.data() }))))
      .catch(() => {});
  }, []);

  return (
    <>
      <h1>Logs & alerts & audit</h1>
      {err ? <p className="err">{err}</p> : null}
      <div className="panel">
        <h2 style={{ fontSize: "1rem" }}>Alerts</h2>
        <table>
          <tbody>
            {alerts.map((r) => (
              <tr key={r.id}>
                <td>{String(r.data["title"] ?? r.id)}</td>
                <td>{String(r.data["severity"] ?? "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h2 style={{ fontSize: "1rem" }}>Audit log</h2>
        <table>
          <thead>
            <tr>
              <th>action</th>
              <th>actor</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((r) => (
              <tr key={r.id}>
                <td>{String(r.data["action"] ?? "")}</td>
                <td>{String(r.data["actorUid"] ?? "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
