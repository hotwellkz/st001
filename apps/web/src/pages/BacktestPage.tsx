import { collection, getDocs, limit, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase.js";

export function BacktestPage() {
  const [rows, setRows] = useState<{ id: string; data: Record<string, unknown> }[]>([]);

  useEffect(() => {
    getDocs(query(collection(db, "backtestResults"), limit(50))).then((snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> })));
    });
  }, []);

  return (
    <>
      <h1>Backtest results</h1>
      <div className="panel">
        <p>Запись результатов — отдельным job в Firestore collection <code>backtestResults</code>.</p>
        <pre style={{ overflow: "auto" }}>{JSON.stringify(rows, null, 2)}</pre>
      </div>
    </>
  );
}
