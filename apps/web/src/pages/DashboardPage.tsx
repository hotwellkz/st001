import { Link } from "react-router-dom";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase.js";

export function DashboardPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const cols = ["orders", "positions", "alerts", "auditLog"];
      const out: Record<string, number> = {};
      for (const c of cols) {
        const q = query(collection(db, c), limit(200));
        const snap = await getDocs(q);
        out[c] = snap.size;
      }
      setCounts(out);
    })().catch(() => setCounts({}));
  }, []);

  return (
    <>
      <h1>Dashboard</h1>
      <div className="panel">
        <p>Быстрые ссылки — все чувствительные действия только через Cloud Functions.</p>
        <ul>
          <li>
            <Link to="/controls">Kill switch / ручные действия</Link>
          </li>
          <li>
            <Link to="/trading">Paper / Live</Link>
          </li>
          <li>
            <Link to="/health">Health</Link>
          </li>
        </ul>
        <p style={{ color: "var(--muted)" }}>
          Примерные размеры выборок (до 200 док.): {JSON.stringify(counts)}
        </p>
      </div>
    </>
  );
}
