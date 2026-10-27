
import { useState } from "react";
import ImageLightbox from "@/components/ImageLightbox";
import { ActionToast, ConfirmationDialog } from "@/components/ActionFeedback";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function displayDate(value) {
  if (!value) return "Belum diisi";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function targetMonth(value) {
  if (!value) return "Tanggal belum dipilih";
  const [year, month] = value.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("id-ID", { month: "long" }).format(
    new Date(year, month - 1, 1)
  );
  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}_${year}`;
}

export default function DraftQueue({
  drafts,
  draftsLoaded,
  selectedDraftIds,
  sendingDrafts,
  sendProgress,
  batchMessage,
  scheduleEnabled,
  hourlySchedule,
  scheduleTimes,
  onScheduleEnabledChange,
  onHourlyScheduleChange,
  onScheduleTimesChange,
  scheduleLoaded,
  onToggleDraft,
  onToggleAll,
  onSendSelected,
  onEditDraft,
  onDeleteDraft,
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [deletingDraftId, setDeletingDraftId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const allSelected = drafts.length > 0 && selectedDraftIds.length === drafts.length;

  return (
    <section className="draft-library" aria-labelledby="draft-library-title">
      <div className="library-heading">
        <div>
          <p className="library-eyebrow">Antrean lokal</p>
          <h2 id="draft-library-title">Laporan tersimpan <span>{drafts.length}</span></h2>
          <p>Draft tersimpan di browser ini. Spreadsheet hanya berubah setelah laporan dipilih dan dikirim.</p>
        </div>
        <div className="library-status"><span />Belum dikirim</div>
      </div>

      <div className="draft-toolbar">
        <label className="select-all-control">
          <input type="checkbox" checked={allSelected} onChange={onToggleAll} disabled={!drafts.length || sendingDrafts} />
          <span>Pilih semua</span>
        </label>
        <span className="selected-count">{selectedDraftIds.length} dipilih</span>
        <button
          type="button"
          className="submit-button batch-submit"
          onClick={() => onSendSelected()}
          disabled={!selectedDraftIds.length || sendingDrafts || !draftsLoaded}
          aria-busy={sendingDrafts}
        >
          {sendingDrafts ? "Mengirim laporan..." : `Kirim ${selectedDraftIds.length} ke spreadsheet`}
        </button>
      </div>

      <section className="draft-scheduler" aria-label="Jadwal pengiriman otomatis">
        <div className="draft-scheduler-heading">
          <div>
            <strong>Pengiriman otomatis</strong>
            <span>Semua draft yang tersimpan akan dikirim pada waktu yang dipilih.</span>
          </div>
          <label className="scheduler-toggle">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              disabled={!scheduleLoaded}
              onChange={(event) => onScheduleEnabledChange(event.target.checked)}
            />
            <span>Aktifkan jadwal</span>
          </label>
        </div>
        <div className="scheduler-times">
          {scheduleTimes.map((time, index) => (
            <label className="scheduler-time" key={`schedule-${index}`}>
              <span>Jam {index + 1}</span>
              <input
                type="time"
                value={time}
                onChange={(event) => onScheduleTimesChange((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                disabled={!scheduleLoaded}
                aria-label={`Jam pengiriman ${index + 1}`}
              />
              <button
                type="button"
                onClick={() => onScheduleTimesChange((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                disabled={!scheduleLoaded || scheduleTimes.length <= 1}
                aria-label={`Hapus jam ${index + 1}`}
              >
                Hapus
              </button>
            </label>
          ))}
          <button
            className="scheduler-add-time"
            type="button"
            onClick={() => onScheduleTimesChange((current) => [...current, "09:00"])}
            disabled={!scheduleLoaded}
          >
            + Tambah jam
          </button>
        </div>
        <label className="scheduler-hourly">
          <input
            type="checkbox"
            checked={hourlySchedule}
            disabled={!scheduleLoaded}
            onChange={(event) => onHourlyScheduleChange(event.target.checked)}
          />
          <span>Kirim juga setiap jam</span>
        </label>
        <p className="scheduler-note">Jadwal tersimpan di browser untuk akun ini. Tab aplikasi harus tetap terbuka agar pengiriman berjalan.</p>
      </section>

      {sendingDrafts && (
        <div className="batch-progress" role="status">
          <span className="progress-track"><span className="progress-indeterminate" /></span>
          <span>{sendProgress || "Menyiapkan laporan..."}</span>
        </div>
      )}

      <ActionToast
        message={sendingDrafts
          ? { type: "progress", text: sendProgress || "Menyiapkan laporan..." }
          : deletingDraftId
            ? { type: "progress", text: "Menghapus draft..." }
            : batchMessage}
      />

      {!draftsLoaded ? (
        <div className="draft-empty-state">Membuka penyimpanan draft...</div>
      ) : drafts.length === 0 ? (
        <div className="draft-empty-state">
          <span className="empty-mark" aria-hidden="true">+</span>
          <strong>Belum ada laporan tersimpan</strong>
          <span>Simpan laporan sebagai draft untuk meninjau dan mengirimnya nanti.</span>
        </div>
      ) : (
        <div className="draft-list">
          {drafts.map((draft) => {
            const checked = selectedDraftIds.includes(draft.id);
            const isConfirmingDelete = confirmingDelete === draft.id;
            const draftImages = draft.images || (draft.imageDataUrl ? [draft.imageDataUrl] : []);
            return (
              <article className={`draft-card${checked ? " is-selected" : ""}`} key={draft.id}>
                <div className="draft-card-top">
                  <label className="draft-select" aria-label={`Pilih laporan ${draft.namaAplikasiDaerah}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleDraft(draft.id)}
                      disabled={sendingDrafts}
                    />
                  </label>
                  <div className="draft-card-title">
                    <strong>{draft.namaAplikasiDaerah || "Laporan tanpa nama"}</strong>
                    <span>{draft.menu || "Menu belum diisi"}</span>
                  </div>
                  <span className={`report-status ${draft.tglSelesai ? "is-complete" : "is-open"}`}>
                    {draft.tglSelesai ? "Selesai" : "Tertunda"}
                  </span>
                  <span className="draft-month">{targetMonth(draft.tglMulai)}</span>
                </div>

                <div className="draft-card-meta">
                  <span>Mulai {displayDate(draft.tglMulai)}</span>
                  <span>{draft.tglSelesai ? `Selesai ${displayDate(draft.tglSelesai)}` : "Tanggal selesai: Tertunda"}</span>
                  {draftImages.length > 0 && (
                    <span className="attachment-tag">{draftImages.length} bukti</span>
                  )}
                </div>

                <div className="draft-problem-preview">
                  <strong>Permasalahan</strong>
                  <span>{draft.permasalahan || "Belum diisi"}</span>
                </div>

                <details className="draft-details">
                  <summary>Lihat detail lengkap</summary>
                  <dl>
                    <div><dt>Nama Aplikasi & Daerah</dt><dd>{draft.namaAplikasiDaerah || "-"}</dd></div>
                    <div><dt>Menu</dt><dd>{draft.menu || "-"}</dd></div>
                    <div><dt>Status pekerjaan</dt><dd>{draft.tglSelesai ? "Selesai" : "Tertunda"}</dd></div>
                    <div><dt>Tanggal mulai</dt><dd>{displayDate(draft.tglMulai)}</dd></div>
                    <div><dt>Tanggal selesai</dt><dd>{draft.tglSelesai ? displayDate(draft.tglSelesai) : "Tertunda"}</dd></div>
                    <div><dt>Permasalahan</dt><dd>{draft.permasalahan || "-"}</dd></div>
                    <div><dt>Solusi</dt><dd>{draft.solusi || "-"}</dd></div>
                    <div><dt>Keterangan</dt><dd>{draft.keterangan || "-"}</dd></div>
                  </dl>
                  {draftImages.length > 0 && (
                    <div className="draft-evidence-gallery" aria-label="Bukti gambar">
                      {draftImages.map((image, index) => {
                        const dataUrl = typeof image === "string" ? image : image.dataUrl;
                        return (
                          <figure className="draft-evidence-card" key={`${draft.id}-image-${index}`}>
                            <button
                              type="button"
                              className="image-preview-trigger draft-evidence-trigger"
                              onClick={() => setPreviewImage({
                                src: dataUrl,
                                alt: `Bukti laporan tersimpan ${index + 1}`,
                              })}
                              aria-label={`Perbesar bukti laporan tersimpan ${index + 1}`}
                            >
                              <img
                                className="draft-evidence"
                                src={dataUrl}
                                alt=""
                              />
                            </button>
                            <figcaption>Bukti {index + 1}</figcaption>
                          </figure>
                        );
                      })}
                    </div>
                  )}
                </details>

                {!isConfirmingDelete && (
                  <div className="draft-actions">
                    <button type="button" onClick={() => onEditDraft(draft)} disabled={sendingDrafts}>Edit laporan</button>
                    <button type="button" className="delete-draft-button" onClick={() => setConfirmingDelete(draft.id)} disabled={sendingDrafts}>Hapus</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {previewImage && (
        <ImageLightbox
          src={previewImage.src}
          alt={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      )}
      <ConfirmationDialog
        title={confirmingDelete ? "Hapus draft?" : ""}
        message={confirmingDelete ? "Draft ini akan dihapus dari penyimpanan browser. Tindakan ini tidak memengaruhi laporan yang sudah dikirim." : ""}
        confirmLabel="Hapus draft"
        danger
        onCancel={() => setConfirmingDelete(null)}
        onConfirm={async () => {
          const draftId = confirmingDelete;
          if (!draftId) return;
          setDeletingDraftId(draftId);
          setConfirmingDelete(null);
          try {
            await onDeleteDraft(draftId);
          } finally {
            setDeletingDraftId(null);
          }
        }}
      />
    </section>
  );
}
