import { Link } from "react-router-dom";
import Icon from "@/components/Icon";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDate(value) {
  if (!value) return "tanggal tidak tersedia";
  const [year, month, day] = value.split("-").map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

export default function PendingReportsPanel({
  worklogs,
  loading,
  error,
  completingId,
  onComplete,
}) {
  const pendingWorklogs = worklogs.filter((worklog) => !worklog.tglSelesai);

  return (
    <section className="pending-reports" aria-labelledby="pending-reports-heading">
      <div className="pending-reports-heading">
        <div>
          <h2 id="pending-reports-heading">Laporan tertunda <span>{pendingWorklogs.length}</span></h2>
          <p>Belum memiliki tanggal selesai.</p>
        </div>
      </div>
      {loading ? (
        <p className="pending-reports-empty" role="status">Memuat laporan tertunda...</p>
      ) : error ? (
        <p className="pending-reports-empty" role="alert">{error}</p>
      ) : pendingWorklogs.length ? (
        <ul className="pending-reports-list">
          {pendingWorklogs.map((worklog) => (
            <li key={worklog.id}>
              <div>
                <strong>{worklog.aplikasi || "Laporan tanpa nama"}</strong>
                <span>{worklog.menu || "Menu belum diisi"} · Mulai {formatDate(worklog.tglMulai)}</span>
                <p>{worklog.permasalahan || "Kendala belum diisi"}</p>
              </div>
              <span className="report-status is-open">Tertunda</span>
              <div className="pending-report-actions">
                <Link
                  className="page-button pending-edit-button"
                  to={`/reports?status=pending&edit=${encodeURIComponent(worklog.id)}`}
                  aria-label={`Edit laporan ${worklog.aplikasi || "tanpa nama"}`}
                >
                  <Icon name="edit" size={15} />
                  <span>Edit</span>
                </Link>
                <button
                  type="button"
                  className="submit-button pending-complete-button"
                  onClick={() => onComplete(worklog)}
                  disabled={Boolean(completingId)}
                  aria-busy={completingId === worklog.id}
                  aria-label={`${completingId === worklog.id ? "Menyimpan" : "Selesaikan"} laporan ${worklog.aplikasi || "tanpa nama"}`}
                >
                  {completingId !== worklog.id && <Icon name="check" size={15} />}
                  {completingId === worklog.id ? "Menyimpan..." : "Selesaikan"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pending-reports-empty">Semua laporan sudah selesai.</p>
      )}
    </section>
  );
}
