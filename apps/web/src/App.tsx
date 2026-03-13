import { Routes, Route, Navigate, Link, Outlet } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "./firebase.js";
import { useAuth } from "./hooks/useAuth.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { StrategyPage } from "./pages/StrategyPage.js";
import { UniversePage } from "./pages/UniversePage.js";
import { PositionsPage } from "./pages/PositionsPage.js";
import { OrdersPage } from "./pages/OrdersPage.js";
import { FillsPage } from "./pages/FillsPage.js";
import { BacktestPage } from "./pages/BacktestPage.js";
import { LogsPage } from "./pages/LogsPage.js";
import { HealthPage } from "./pages/HealthPage.js";
import { ControlsPage } from "./pages/ControlsPage.js";
import { TradingModePage } from "./pages/TradingModePage.js";

function Layout() {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div className="main">…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin)
    return (
      <div className="main panel">
        <p className="err">Нет прав admin. Назначьте custom claim admin через bootstrap function.</p>
      </div>
    );
  return (
    <div className="layout">
      <nav className="nav">
        <Link to="/">Dashboard</Link>
        <Link to="/strategy">Strategy</Link>
        <Link to="/universe">Universe</Link>
        <Link to="/positions">Positions</Link>
        <Link to="/orders">Orders</Link>
        <Link to="/fills">Fills</Link>
        <Link to="/backtest">Backtest</Link>
        <Link to="/logs">Logs / Alerts</Link>
        <Link to="/health">Health</Link>
        <Link to="/controls">Controls</Link>
        <Link to="/trading">Paper / Live</Link>
        <hr />
        <button type="button" onClick={() => signOut(auth)}>
          Выйти
        </button>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/strategy" element={<StrategyPage />} />
        <Route path="/universe" element={<UniversePage />} />
        <Route path="/positions" element={<PositionsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/fills" element={<FillsPage />} />
        <Route path="/backtest" element={<BacktestPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/controls" element={<ControlsPage />} />
        <Route path="/trading" element={<TradingModePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
