
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import ImageLightbox from "@/components/ImageLightbox";
import { getDriveImageUrl } from "@/lib/googleDrive";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(value) {
  if (!value) return "Tanggal tidak tersedia";
  const [year, month, day] = value.split("-").map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

function getEvidenceImages(keterangan) {
  const links = String(keterangan || "").match(/https?:\/\/[^\s]+/g) || [];
  const seen = new Set();
  return links.flatMap((rawLink, index) => {
    const link = rawLink.replace(/[),.;]+$/, "");
    try {
      const url = new URL(link);
      if (url.hostname !== "drive.google.com") return [];
      const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id");
      if (!fileId || seen.has(fileId)) return [];
      seen.add(fileId);
      return [{
        id: fileId,
        label: `Bukti ${index + 1}`,
        link,
      }];
    } catch {
      return [];
    }
  });
}

function EvidenceImage({ image, reportName, onPreview }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc("");
    setFailed(false);
    getDriveImageUrl(image.id)
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [image.id]);

  return (
    <article className="report-detail-image-card">
      <button
        type="button"
        className="image-preview-trigger report-detail-image-trigger"
        onClick={() => src && onPreview({ src, alt: `${image.label} laporan ${reportName || ""}` })}
        aria-label={`Perbesar ${image.label}`}
      >
        <img
          src={src || undefined}
          alt={image.label}
          hidden={failed}
          onError={() => setFailed(true)}
        />
        <span>Pratinjau tidak tersedia</span>
      </button>
      <a href={image.link} target="_blank" rel="noreferrer">{image.label} · Buka di Drive</a>
    </article>
  );
}

export default function ReportDetailDialog({ report, onClose }) {
  const [previewImage, setPreviewImage] = useState(null);
  if (!report) return null;

  const evidenceImages = getEvidenceImages(report.keterangan);

  return (
    <>
      <div className="report-editor-backdrop" onClick={onClose}>
        <section
          className="report-editor-dialog report-detail-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-detail-heading"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="report-editor-heading">
            <div>
              <span className="panel-eyebrow">Detail laporan</span>
              <h2 id="report-detail-heading">{report.aplikasi || "Laporan tanpa nama"}</h2>
            </div>
            <button type="button" className="image-lightbox-close report-editor-close" onClick={onClose} aria-label="Tutup detail laporan">
              <Icon name="close" size={18} />
            </button>
          </div>
          <dl className="report-detail-fields">
            <div><dt>Nama aplikasi & daerah</dt><dd>{report.aplikasi || "—"}</dd></div>
            <div><dt>Menu</dt><dd>{report.menu || "—"}</dd></div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`report-status ${report.tglSelesai ? "is-complete" : "is-open"}`}>
                  {report.tglSelesai ? "Selesai" : "Tertunda"}
                </span>
              </dd>
            </div>
            <div><dt>Tanggal mulai</dt><dd>{formatDate(report.tglMulai)}</dd></div>
            <div><dt>Tanggal selesai</dt><dd>{report.tglSelesai ? formatDate(report.tglSelesai) : "Belum selesai"}</dd></div>
            <div className="report-detail-field-wide"><dt>Permasalahan</dt><dd>{report.permasalahan || "—"}</dd></div>
            <div className="report-detail-field-wide"><dt>Solusi / tindak lanjut</dt><dd>{report.solusi || "—"}</dd></div>
            <div className="report-detail-field-wide"><dt>Keterangan</dt><dd>{report.keterangan || "—"}</dd></div>
          </dl>
          <section className="report-detail-evidence" aria-labelledby="report-detail-evidence-heading">
            <h3 id="report-detail-evidence-heading">Bukti gambar</h3>
            {evidenceImages.length ? (
              <div className="report-detail-image-grid">
                {evidenceImages.map((image) => (
                  <EvidenceImage
                    key={image.id}
                    image={image}
                    reportName={report.aplikasi}
                    onPreview={setPreviewImage}
                  />
                ))}
              </div>
            ) : (
              <p className="report-detail-no-evidence">Tidak ada tautan gambar pada laporan ini.</p>
            )}
          </section>
        </section>
      </div>
      {previewImage && (
        <ImageLightbox
          src={previewImage.src}
          alt={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </>
  );
}