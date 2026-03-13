import { collection, getDocs, limit, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase.js";

export function PositionsPage() {
  const [rows, setRows] = useState<{ id: string; data: Record<string, unknown> }[]>([]);

  useEffect(() => {
    getDocs(query(collection(db, "positions"), limit(100))).then((snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> })));
    });
  }, []);

  return (
    <>
      <h1>Open positions</h1>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>id</th>
              <th>symbol</th>
              <th>qty</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{String(r.data["symbol"] ?? "")}</td>
                <td>{String(r.data["quantity"] ?? "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
