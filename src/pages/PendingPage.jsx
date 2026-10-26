import { useEffect, useState } from "react";
import { signIn, useSession } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { readGoogleSettings } from "@/lib/googleSettings";
import { completeWorklog } from "@/lib/worklogs";
import { ActionToast, ConfirmationDialog, useConfirmation } from "@/components/ActionFeedback";
import AppHeader from "@/components/AppHeader";
import PendingReportsPanel from "@/components/PendingReportsPanel";

function todayAsInputValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export default function PendingPage() {
  const { data: session, status } = useSession();
  const [worklogs, setWorklogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const { confirm, confirmation, acceptConfirmation, cancelConfirmation } = useConfirmation();

  async function loadWorklogs() {
    setLoading(true);
    setError("");
    try {
      const settings = readGoogleSettings(session?.user?.email);
      if (!settings?.spreadsheetId) throw new Error("Selesaikan setup Google terlebih dahulu.");
      const response = await apiFetch(`/api/dashboard?spreadsheetId=${encodeURIComponent(settings.spreadsheetId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memuat laporan tertunda.");
      if (!Array.isArray(data.worklogs)) throw new Error("Format data laporan tidak valid.");
      setWorklogs(data.worklogs);
    } catch (loadError) {
      setError(loadError.message || "Gagal memuat laporan tertunda.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user?.email) void loadWorklogs();
  }, [session?.user?.email]);

  async function handleComplete(worklog) {
    const completedAt = todayAsInputValue();
    if (!(await confirm({
      title: "Selesaikan laporan tertunda?",
      message: `Tanggal selesai laporan “${worklog.aplikasi || "Tanpa nama"}” akan diisi otomatis dengan hari ini (${formatDate(completedAt)}) dan langsung disimpan ke spreadsheet.`,
      confirmLabel: "Ya, selesaikan",
    }))) return;

    setCompletingId(worklog.id);
    setMessage({ type: "progress", text: "Menyimpan tanggal selesai ke spreadsheet..." });
    try {
      const settings = readGoogleSettings(session?.user?.email);
      const result = await completeWorklog(worklog, settings?.spreadsheetId, completedAt);
      setWorklogs((current) => current.map((item) =>
        item.id === worklog.id ? { ...item, tglSelesai: completedAt } : item
      ));
      window.dispatchEvent(new Event("daily-worklog:counts-updated"));
      setMessage({
        type: "success",
        text: `Laporan berhasil diselesaikan dengan tanggal ${formatDate(completedAt)}.${result.borderWarning ? ` ${result.borderWarning}` : ""}`,
      });
    } catch (completeError) {
      setMessage({ type: "error", text: completeError.message || "Laporan gagal diselesaikan." });
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <main className="app-shell">
      <AppHeader />
      {status === "loading" ? (
        <div className="state-panel workspace-content" role="status">Memuat status akun...</div>
      ) : session ? (
        <div className="page-content workspace-content">
          <section className="page-intro">
            <div>
              <p className="page-eyebrow"><span />Aktivitas</p>
              <h1>Laporan <em>tertunda.</em></h1>
              <p className="page-subtitle">Edit laporan atau tandai selesai hari ini.</p>
            </div>
            <button type="button" className="page-button" onClick={() => void loadWorklogs()} disabled={loading} aria-busy={loading}>
              {loading ? "Memuat..." : "Muat ulang"}
            </button>
          </section>
          <ActionToast message={message} onClose={() => setMessage(null)} />
          <PendingReportsPanel
            worklogs={worklogs}
            loading={loading}
            error={error}
            completingId={completingId}
            onComplete={handleComplete}
          />
        </div>
      ) : (
        <div className="page-content workspace-content">
          <section className="auth-panel">
            <div className="auth-mark" aria-hidden="true">WL</div>
            <div>
              <p className="auth-eyebrow">Akses workspace</p>
              <h2>Masuk untuk melihat laporan tertunda</h2>
              <p>Gunakan akun Google Anda.</p>
            </div>
            <button className="session-button sign-in-button" onClick={() => signIn("google")}>
              Masuk dengan Google
            </button>
          </section>
        </div>
      )}
      <ConfirmationDialog
        {...confirmation}
        onConfirm={acceptConfirmation}
        onCancel={cancelConfirmation}
      />
    </main>
  );
}
