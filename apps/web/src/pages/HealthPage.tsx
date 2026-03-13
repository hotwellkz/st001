import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase.js";

export function HealthPage() {
  const [engine, setEngine] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    getDoc(doc(db, "engineState", "singleton")).then((s) => {
      setEngine(s.exists() ? (s.data() as Record<string, unknown>) : {});
    });
  }, []);

  return (
    <>
      <h1>System health</h1>
      <div className="panel">
        <p>
          <strong>engineState/singleton</strong> (read-only UI)
        </p>
        <pre>{JSON.stringify(engine, null, 2)}</pre>
        <p className="ok">Клиент не может писать в engineState — только Functions.</p>
      </div>
    </>
  );
}
