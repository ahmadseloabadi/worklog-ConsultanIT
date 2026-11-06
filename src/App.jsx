import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import HomePage from "@/pages/HomePage";

// Halaman lain dimuat saat dibuka agar bundel awal kecil.
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const PendingPage = lazy(() => import("@/pages/PendingPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const SetupPage = lazy(() => import("@/pages/SetupPage"));
const MiniGamesPage = lazy(() => import("@/pages/MiniGamesPage"));
const DocumentToolsPage = lazy(() => import("@/pages/DocumentToolsPage"));

export default function App() {
  return (
    <Suspense fallback={<div className="state-panel" role="status">Memuat halaman...</div>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/pending" element={<PendingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/mini-games" element={<MiniGamesPage />} />
        <Route path="/document-tools" element={<Navigate to="/document-tools/image" replace />} />
        <Route path="/document-tools/:toolId" element={<DocumentToolsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
