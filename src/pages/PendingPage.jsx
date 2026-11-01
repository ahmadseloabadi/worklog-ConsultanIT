import { useEffect, useState } from "react";
import { signIn, useSession } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { readGoogleSettings } from "@/lib/googleSettings";
import { completeWorklog } from "@/lib/worklogs";
import { ActionToast, ConfirmationDialog, useConfirmation } from "@/components/ActionFeedback";
import AppHeader from "@/components/AppHeader";
import Icon from "@/components/Icon";
import PendingReportsPanel from "@/components/PendingReportsPanel";
import ReportDetailDialog from "@/components/ReportDetailDialog";

const emptyReportForm = {
  namaAplikasiDaerah: "",
  menu: "",
  tglMulai: "",
  permasalahan: "",
  solusi: "",
  tglSelesai: "",
  keterangan: "",
};

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
  const [completionWorklog, setCompletionWorklog] = useState(null);
  const [completionDate, setCompletionDate] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [viewingWorklog, setViewingWorklog] = useState(null);
  const [editingWorklog, setEditingWorklog] = useState(null);
  const [editForm, setEditForm] = useState(emptyReportForm);
  const [savingEdit, setSavingEdit] = useState(false);
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

  function handleEdit(worklog) {
    setEditingWorklog(worklog);
    setEditForm({
      namaAplikasiDaerah: worklog.aplikasi || "",
      menu: worklog.menu || "",
      tglMulai: worklog.tglMulai || "",
      permasalahan: worklog.permasalahan || "",
      solusi: worklog.solusi || "",
      tglSelesai: worklog.tglSelesai || "",
      keterangan: worklog.keterangan || "",
    });
    setMessage(null);
  }

  function closeEditor() {
    if (savingEdit) return;
    setEditingWorklog(null);
    setEditForm(emptyReportForm);
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    if (!editingWorklog || editForm.tglSelesai < editForm.tglMulai) return;
    setSavingEdit(true);
    setMessage(null);
    try {
      const settings = readGoogleSettings(session?.user?.email);
      const response = await apiFetch(`/api/log/${encodeURIComponent(editingWorklog.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          expected: editingWorklog,
          spreadsheetId: settings?.spreadsheetId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Laporan gagal diperbarui.");
      const updatedWorklog = {
        ...editingWorklog,
        aplikasi: editForm.namaAplikasiDaerah,
        menu: editForm.menu,
        tglMulai: editForm.tglMulai,
        permasalahan: editForm.permasalahan,
        solusi: editForm.solusi,
        tglSelesai: editForm.tglSelesai,
        keterangan: editForm.keterangan,
      };
      setWorklogs((current) => current.map((item) =>
        item.id === editingWorklog.id ? updatedWorklog : item
      ));
      window.dispatchEvent(new Event("daily-worklog:counts-updated"));
      setEditingWorklog(null);
      setEditForm(emptyReportForm);
      setMessage({
        type: "success",
        text: `Laporan berhasil diperbarui di spreadsheet.${data.borderWarning ? ` ${data.borderWarning}` : ""}`,
      });
    } catch (saveError) {
      setMessage({ type: "error", text: saveError.message || "Laporan gagal diperbarui." });
    } finally {
      setSavingEdit(false);
    }
  }

  function handleComplete(worklog) {
    setCompletionWorklog(worklog);
    setCompletionDate(todayAsInputValue());
    setMessage(null);
  }

  function closeCompletionDialog() {
    if (completingId) return;
    setCompletionWorklog(null);
    setCompletionDate("");
  }

  async function handleConfirmComplete(event) {
    event.preventDefault();
    if (!completionWorklog || !completionDate || completionDate < completionWorklog.tglMulai) return;

    const worklog = completionWorklog;
    const completedAt = completionDate;
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
      setCompletionWorklog(null);
      setCompletionDate("");
    } catch (completeError) {
      setMessage({ type: "error", text: completeError.message || "Laporan gagal diselesaikan." });
      setCompletionWorklog(null);
      setCompletionDate("");
    } finally {
      setCompletingId(null);
    }
  }

  async function handleDelete(worklog) {
    if (!(await confirm({
      title: "Hapus laporan?",
      message: `Laporan “${worklog.aplikasi || "Tanpa nama"}” pada ${formatDate(worklog.tglMulai)} akan dihapus dari spreadsheet. Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: "Hapus laporan",
      danger: true,
    }))) return;

    setDeletingId(worklog.id);
    setMessage(null);
    try {
      const settings = readGoogleSettings(session?.user?.email);
      const response = await apiFetch(`/api/log/${encodeURIComponent(worklog.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected: worklog, spreadsheetId: settings?.spreadsheetId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Laporan gagal dihapus.");
      setWorklogs((current) => current.filter((item) => item.id !== worklog.id));
      window.dispatchEvent(new Event("daily-worklog:counts-updated"));
      if (editingWorklog?.id === worklog.id) closeEditor();
      if (viewingWorklog?.id === worklog.id) setViewingWorklog(null);
      setMessage({
        type: "success",
        text: `Laporan berhasil dihapus dari spreadsheet.${data.borderWarning ? ` ${data.borderWarning}` : ""}`,
      });
    } catch (deleteError) {
      setMessage({ type: "error", text: deleteError.message || "Laporan gagal dihapus." });
    } finally {
      setDeletingId(null);
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
            deletingId={deletingId}
            onEdit={handleEdit}
            onView={setViewingWorklog}
            onComplete={handleComplete}
            onDelete={handleDelete}
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
      <ReportDetailDialog report={viewingWorklog} onClose={() => setViewingWorklog(null)} />
      {completionWorklog && (
        <div
          className="action-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCompletionDialog();
          }}
        >
          <form
            className="action-dialog completion-date-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="completion-date-title"
            onSubmit={handleConfirmComplete}
          >
            <span className="action-dialog-symbol" aria-hidden="true">
              <Icon name="check" size={21} />
            </span>
            <div className="action-dialog-copy">
              <h2 id="completion-date-title">Selesaikan laporan tertunda?</h2>
              <p>Pilih tanggal selesai untuk laporan “{completionWorklog.aplikasi || "Tanpa nama"}”. Tanggal otomatis diisi hari ini, tetapi dapat diubah.</p>
              <label className="field completion-date-field">
                <span className="field-label">Tanggal selesai</span>
                <input
                  className="field-control"
                  type="date"
                  value={completionDate}
                  min={completionWorklog.tglMulai || undefined}
                  onChange={(event) => setCompletionDate(event.target.value)}
                  required
                />
              </label>
              {completionDate && completionDate < completionWorklog.tglMulai && (
                <p className="field-error" role="alert">Tanggal selesai tidak boleh lebih awal dari tanggal mulai.</p>
              )}
            </div>
            <div className="action-dialog-actions">
              <button type="button" className="action-dialog-cancel" onClick={closeCompletionDialog} disabled={Boolean(completingId)}>Batal</button>
              <button
                type="submit"
                className="action-dialog-confirm"
                disabled={!completionDate || completionDate < completionWorklog.tglMulai || Boolean(completingId)}
                aria-busy={completingId === completionWorklog.id}
              >
                {completingId === completionWorklog.id ? "Menyimpan..." : "Ya, selesaikan"}
              </button>
            </div>
          </form>
        </div>
      )}
      {editingWorklog && (
        <div className="report-editor-backdrop" onClick={closeEditor}>
          <section
            className="report-editor-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pending-report-editor-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="report-editor-heading">
              <div>
                <span className="panel-eyebrow">Laporan tertunda</span>
                <h2 id="pending-report-editor-heading">Edit laporan</h2>
              </div>
              <button
                type="button"
                className="image-lightbox-close report-editor-close"
                onClick={closeEditor}
                aria-label="Tutup form edit"
                disabled={savingEdit}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            {message?.type === "error" && (
              <p className="form-message error" role="alert">
                <span className="message-mark" aria-hidden="true">!</span>
                {message.text}
              </p>
            )}
            <form className="report-editor-form" onSubmit={handleSaveEdit}>
              <label className="field">
                <span className="field-label">Nama Aplikasi & Daerah <span className="required-mark">*</span></span>
                <input className="field-control" value={editForm.namaAplikasiDaerah} onChange={(event) => setEditForm({ ...editForm, namaAplikasiDaerah: event.target.value })} required />
              </label>
              <label className="field">
                <span className="field-label">Menu <span className="required-mark">*</span></span>
                <input className="field-control" value={editForm.menu} onChange={(event) => setEditForm({ ...editForm, menu: event.target.value })} required />
              </label>
              <div className="field-grid">
                <label className="field">
                  <span className="field-label">Tanggal mulai <span className="required-mark">*</span></span>
                  <input className="field-control" type="date" value={editForm.tglMulai} onChange={(event) => setEditForm({ ...editForm, tglMulai: event.target.value })} required />
                </label>
                <label className="field">
                  <span className="field-label">Tanggal selesai</span>
                  <input className="field-control" type="date" value={editForm.tglSelesai} min={editForm.tglMulai || undefined} onChange={(event) => setEditForm({ ...editForm, tglSelesai: event.target.value })} />
                </label>
              </div>
              {editForm.tglMulai && editForm.tglSelesai && editForm.tglSelesai < editForm.tglMulai && (
                <p className="field-error" role="alert">Tanggal selesai tidak boleh lebih awal dari tanggal mulai.</p>
              )}
              <label className="field">
                <span className="field-label">Permasalahan <span className="required-mark">*</span></span>
                <textarea className="field-control" rows={3} value={editForm.permasalahan} onChange={(event) => setEditForm({ ...editForm, permasalahan: event.target.value })} required />
              </label>
              <label className="field">
                <span className="field-label">Solusi / tindak lanjut <span className="required-mark">*</span></span>
                <textarea className="field-control" rows={3} value={editForm.solusi} onChange={(event) => setEditForm({ ...editForm, solusi: event.target.value })} required />
              </label>
              <label className="field">
                <span className="field-label">Keterangan</span>
                <textarea className="field-control" rows={2} value={editForm.keterangan} onChange={(event) => setEditForm({ ...editForm, keterangan: event.target.value })} />
              </label>
              <div className="report-editor-actions">
                <button type="button" className="page-button" onClick={closeEditor} disabled={savingEdit}>Batal</button>
                <button type="submit" className="submit-button" disabled={savingEdit || editForm.tglSelesai < editForm.tglMulai} aria-busy={savingEdit}>
                  {savingEdit ? "Menyimpan..." : "Simpan perubahan"}
                </button>
              </div>
            </form>
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
