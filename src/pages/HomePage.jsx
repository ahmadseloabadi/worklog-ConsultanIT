import { useSession, signIn } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import LogForm from "@/components/LogForm";

export default function HomePage() {
  const { data: session, status } = useSession();

  return (
    <main className="app-shell">
      <AppHeader />

      <div className="page-content">
        <section className="page-intro">
          <div>
            <p className="page-eyebrow"><span />Aktivitas</p>
            <h1>Laporan <em>baru.</em></h1>
            <p className="page-subtitle">Catat pekerjaan atau simpan sebagai draft.</p>
          </div>
        </section>

        {status === "loading" ? (
          <div className="state-panel" role="status">Memuat status akun...</div>
        ) : session ? (
          <LogForm />
        ) : (
          <section className="auth-panel">
            <div className="auth-mark" aria-hidden="true">WL</div>
            <div>
              <p className="auth-eyebrow">Akses workspace</p>
              <h2>Masuk untuk mulai mencatat</h2>
              <p>Gunakan akun Google Anda.</p>
            </div>
            <button className="session-button sign-in-button" onClick={() => signIn("google")}>
              Masuk dengan Google
            </button>
          </section>
        )}
      </div>
    </main>
  );
}