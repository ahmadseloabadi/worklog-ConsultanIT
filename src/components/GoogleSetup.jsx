
import { useEffect, useState } from "react";
import { signIn, useSession } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { extractGoogleResourceId, readGoogleSettings, saveGoogleSettings } from "@/lib/googleSettings";
import AppHeader from "@/components/AppHeader";
import { ActionToast } from "@/components/ActionFeedback";

export default function GoogleSetup() {
  const { data: session, status } = useSession();
  const [spreadsheetLink, setSpreadsheetLink] = useState("");
  const [folderLink, setFolderLink] = useState("");
  const [savedSettings, setSavedSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [checkingToken, setCheckingToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const email = session?.user?.email;
    setSavedSettings(null);
    setSpreadsheetLink("");
    setFolderLink("");
    setTokenStatus(null);
    setMessage(null);
    if (!email) return;
    const settings = readGoogleSettings(email);
    if (settings) {
      setSavedSettings(settings);
      setSpreadsheetLink(settings.spreadsheetLink || "");
      setFolderLink(settings.folderLink || "");
    }
  }, [session?.user?.email]);

  async function handleSave(event) {
    event.preventDefault();
    if (!session?.user?.email) return;
    setSaving(true);
    setMessage(null);
    try {
      const spreadsheetId = extractGoogleResourceId(spreadsheetLink, "spreadsheet");
      const folderId = extractGoogleResourceId(folderLink, "folder");
      const response = await apiFetch("/api/setup/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId, folderId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Link tidak dapat diakses.");

      const settings = {
        spreadsheetId,
        folderId,
        spreadsheetLink,
        folderLink,
        spreadsheetName: result.spreadsheet.name,
        folderName: result.folder.name,
      };
      saveGoogleSettings(session.user.email, settings);
      setSavedSettings(settings);
      setMessage({ type: "success", text: "Setup selesai. Akun ini dapat memakai spreadsheet dan folder gambar." });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Setup gagal disimpan." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckToken() {
    setCheckingToken(true);
    setTokenStatus(null);
    try {
      const response = await apiFetch("/api/auth/status");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Status token tidak dapat diperiksa.");
      setTokenStatus({
        type: result.active ? "success" : "error",
        text: result.message,
      });
    } catch (error) {
      setTokenStatus({
        type: "error",
        text: error.message || "Status token tidak dapat diperiksa.",
      });
    } finally {
      setCheckingToken(false);
    }
  }

  return (
    <main className="app-shell">
      <AppHeader />
      <div className="page-content">
        <ActionToast
          message={saving
            ? { type: "progress", text: "Memeriksa akses dan menyimpan pengaturan Google..." }
            : checkingToken
              ? { type: "progress", text: "Memeriksa status koneksi Google..." }
              : message || tokenStatus}
          onClose={() => {
            setMessage(null);
            setTokenStatus(null);
          }}
        />
        <section className="page-intro">
          <div>
            <p className="page-eyebrow"><span />Pengaturan</p>
            <h1>Hubungkan <em>Google.</em></h1>
            <p className="page-subtitle">Pilih spreadsheet laporan dan folder bukti.</p>
          </div>
        </section>

        {status === "loading" ? (
          <div className="state-panel" role="status">Memuat status akun...</div>
        ) : !session ? (
          <section className="auth-panel">
            <div className="auth-mark" aria-hidden="true">WL</div>
            <div>
              <p className="auth-eyebrow">Akses Google</p>
              <h2>Masuk untuk mengatur koneksi</h2>
              <p>Gunakan akun Google yang punya akses ke file.</p>
            </div>
            <button className="session-button sign-in-button" onClick={() => signIn("google")}>
              Masuk dengan Google
            </button>
          </section>
        ) : (
          <form className="setup-card" onSubmit={handleSave}>
            <div className="setup-card-heading">
              <div>
                <span className="summary-eyebrow">Akun aktif</span>
                <h2>{session.user.email}</h2>
              </div>
              {savedSettings && <span className="setup-status">Setup tersimpan di browser ini</span>}
            </div>
            <p className="setup-description">
              Masukkan link spreadsheet dan folder Drive. Akun Google perlu izin Editor dan akses unggah.
            </p>
            <div className="token-check">
              <div>
                <span className="summary-eyebrow">Koneksi Google</span>
                <p className="setup-description">Cek akses Google.</p>
              </div>
              <button
                className="clear-form-button"
                type="button"
                onClick={handleCheckToken}
                disabled={checkingToken}
                aria-busy={checkingToken}
              >
                {checkingToken ? "Memeriksa token..." : "Periksa token"}
              </button>
            </div>
            <label className="field">
              <span className="field-label">Link spreadsheet laporan</span>
              <input
                className="field-control"
                type="url"
                value={spreadsheetLink}
                onChange={(event) => setSpreadsheetLink(event.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Link folder bukti gambar</span>
              <input
                className="field-control"
                type="url"
                value={folderLink}
                onChange={(event) => setFolderLink(event.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                required
              />
            </label>
            <div className="setup-card-footer">
              {savedSettings && (
                <><span>File Spreadsheet: {savedSettings.spreadsheetName} | Folder GDrive: {savedSettings.folderName}</span></>
              )}
              <button className="submit-button" type="submit" disabled={saving} aria-busy={saving}>
                {saving ? "Memeriksa akses..." : savedSettings ? "Perbarui setup" : "Simpan setup"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
