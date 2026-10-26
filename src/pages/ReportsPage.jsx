import { signIn, useSession } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import ReportManager from "@/components/ReportManager";

export default function ReportsPage() {
  const { data: session, status } = useSession();

  return (
    <main className="app-shell">
      <AppHeader />
      {status === "loading" ? (
        <div className="state-panel" role="status">Memuat status akun...</div>
      ) : session ? (
        <ReportManager />
      ) : (
        <div className="page-content">
          <section className="auth-panel">
            <div className="auth-mark" aria-hidden="true">WL</div>
            <div>
              <p className="auth-eyebrow">Akses workspace</p>
              <h2>Masuk untuk mengelola laporan</h2>
              <p>Gunakan akun Google yang memiliki akses ke laporan kerja.</p>
            </div>
            <button className="session-button sign-in-button" onClick={() => signIn("google")}>
              Masuk dengan Google
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
