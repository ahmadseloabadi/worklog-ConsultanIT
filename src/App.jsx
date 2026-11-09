import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import HomePage from "@/pages/HomePage";
import LoadingScreen from "@/components/LoadingScreen";

// Halaman lain dimuat saat dibuka agar bundel awal kecil.
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const PendingPage = lazy(() => import("@/pages/PendingPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const SetupPage = lazy(() => import("@/pages/SetupPage"));
const MiniGamesPage = lazy(() => import("@/pages/MiniGamesPage"));
const DocumentToolsPage = lazy(() => import("@/pages/DocumentToolsPage"));
const PrivacyPolicyPage = lazy(() => import("@/pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("@/pages/TermsOfServicePage"));
const NotesTodosPage = lazy(() => import("@/pages/NotesTodosPage"));
const CalendarPage = lazy(() => import("@/pages/CalendarPage"));

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/pending" element={<PendingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/notes" element={<NotesTodosPage />} />
        <Route path="/todos" element={<NotesTodosPage />} />
        <Route path="/notes-todos" element={<Navigate to="/notes" replace />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/mini-games" element={<MiniGamesPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route path="/document-tools" element={<Navigate to="/document-tools/image" replace />} />
        <Route path="/document-tools/:toolId" element={<DocumentToolsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
