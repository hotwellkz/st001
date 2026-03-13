import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

export function LoginPage() {
  const { user, signIn, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  if (!loading && user && isAdmin) return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await signIn(email, pass);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка входа");
    }
  }

  return (
    <div className="main" style={{ maxWidth: 360, margin: "4rem auto" }}>
      <h1>Вход (admin)</h1>
      <form onSubmit={submit} className="panel">
        <p>
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </p>
        <p>
          <input
            type="password"
            placeholder="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
          />
        </p>
        {err ? <p className="err">{err}</p> : null}
        <button type="submit">Войти</button>
      </form>
      <p className="muted" style={{ color: "var(--muted)" }}>
        После первого деплоя вызовите bootstrap function с секретом, затем войдите.
      </p>
    </div>
  );
}
