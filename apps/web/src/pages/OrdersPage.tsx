import { collection, getDocs, limit, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase.js";

export function OrdersPage() {
  const [rows, setRows] = useState<{ id: string; data: Record<string, unknown> }[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    getDocs(query(collection(db, "orders"), limit(80)))
      .then((snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> })));
      })
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <>
      <h1>Orders</h1>
      {err ? <p className="err">{err}</p> : null}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>clientOrderId</th>
              <th>status</th>
              <th>symbol</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{String(r.data["status"] ?? "")}</td>
                <td>{String(r.data["symbol"] ?? "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
