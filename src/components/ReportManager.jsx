
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { readGoogleSettings } from "@/lib/googleSettings";
import { findSimilarValueGroups } from "@/lib/similarValues";
import { ActionToast, ConfirmationDialog, useConfirmation } from "@/components/ActionFeedback";
import ReportDetailDialog from "@/components/ReportDetailDialog";
import Icon from "@/components/Icon";
import WorkStatusToggle from "@/components/WorkStatusToggle";

const emptyReport = {
  namaAplikasiDaerah: "",
  menu: "",
  tglMulai: "",
  permasalahan: "",
  solusi: "",
  tglSelesai: "",
  keterangan: "",
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function todayAsInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "Tanggal tidak tersedia";
  const [year, month, day] = value.split("-").map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

export default function ReportManager() {
  const { data: session } = useSession();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [menuFilter, setMenuFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(() =>
    new URLSearchParams(window.location.search).get("status") === "pending" ? "pending" : "all"
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dateSort, setDateSort] = useState(null);
  const [selectedSimilarValues, setSelectedSimilarValues] = useState({});
  const [selectedSimilarVariants, setSelectedSimilarVariants] = useState({});
  const [similarValueSearch, setSimilarValueSearch] = useState("");
  const [showSimilarTools, setShowSimilarTools] = useState(false);
  const [normalizingGroup, setNormalizingGroup] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [form, setForm] = useState(emptyReport);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const { confirm, confirmation, acceptConfirmation, cancelConfirmation } = useConfirmation();

  async function loadReports() {
    setLoading(true);
    setLoadError("");
    try {
      const settings = readGoogleSettings(session?.user?.email);
      if (!settings?.spreadsheetId) {
        throw new Error("Selesaikan setup Google terlebih dahulu.");
      }
      const response = await apiFetch(
        `/api/dashboard?spreadsheetId=${encodeURIComponent(settings.spreadsheetId)}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memuat laporan.");
      if (!Array.isArray(data.worklogs)) throw new Error("Format data laporan tidak valid.");
      setReports(data.worklogs);
      setPage(1);
    } catch (error) {
      setLoadError(error.message || "Gagal memuat laporan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user?.email) void loadReports();
  }, [session?.user?.email]);

  const months = useMemo(() => [...new Set(
    reports.map((report) => report.tglMulai?.slice(0, 7)).filter((month) => /^\d{4}-\d{2}$/.test(month || ""))
  )].sort((a, b) => b.localeCompare(a)), [reports]);
  const applications = useMemo(() => [...new Set(
    reports.map((report) => report.aplikasi).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "id")), [reports]);
  const menus = useMemo(() => [...new Set(
    reports
      .filter((report) => applicationFilter === "all" || report.aplikasi === applicationFilter)
      .map((report) => report.menu)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "id")), [applicationFilter, reports]);
  const similarGroups = useMemo(() => ["aplikasi", "menu"].flatMap((field) =>
    findSimilarValueGroups(reports, field).map((groupVariants) => {
      const variants = [...groupVariants].sort((a, b) => a.localeCompare(b, "id"));
      const variantCounts = variants.map((value) => ({
        value,
        count: reports.filter((report) => report[field] === value).length,
      }));
      const preferredValue = [...variantCounts].sort(
        (left, right) => right.count - left.count || left.value.localeCompare(right.value, "id")
      )[0].value;
      return {
        field,
        key: `${field}:${variants.join("|")}`,
        variants,
        variantCounts,
        preferredValue,
        reports: reports.filter((report) => variants.includes(report[field])),
      };
    })
  ), [reports]);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return reports.filter((report) => {
      if (monthFilter !== "all" && !report.tglMulai?.startsWith(monthFilter)) return false;
      if (applicationFilter !== "all" && report.aplikasi !== applicationFilter) return false;
      if (menuFilter !== "all" && report.menu !== menuFilter) return false;
      if (statusFilter === "completed" && !report.tglSelesai) return false;
      if (statusFilter === "pending" && report.tglSelesai) return false;
      if (query && ![
        report.aplikasi,
        report.menu,
        report.tglMulai,
        report.permasalahan,
        report.solusi,
        report.tglSelesai,
        report.keterangan,
        report.tglSelesai ? "selesai completed" : "pending",
      ].join(" ").toLocaleLowerCase("id-ID").includes(query)) return false;
      return true;
    });
  }, [applicationFilter, menuFilter, monthFilter, reports, search, statusFilter]);

  const sortedReports = useMemo(() => {
    if (!dateSort) return filteredReports;
    const { field, direction } = dateSort;
    return [...filteredReports].sort((left, right) => {
      const leftDate = left[field] || "";
      const rightDate = right[field] || "";
      if (!leftDate && !rightDate) return 0;
      if (!leftDate) return 1;
      if (!rightDate) return -1;
      return leftDate.localeCompare(rightDate) * direction;
    });
  }, [dateSort, filteredReports]);

  const pageCount = Math.ceil(sortedReports.length / pageSize);
  const currentPage = Math.min(page, Math.max(1, pageCount));
  const firstVisibleRow = sortedReports.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastVisibleRow = Math.min(currentPage * pageSize, sortedReports.length);
  const paginatedReports = sortedReports.slice(firstVisibleRow - 1, lastVisibleRow);

  useEffect(() => {
    setPage(1);
  }, [applicationFilter, menuFilter, monthFilter, pageSize, search, statusFilter]);

  function startEditing(report) {
    setEditingReport(report);
    setForm({
      namaAplikasiDaerah: report.aplikasi || "",
      menu: report.menu || "",
      tglMulai: report.tglMulai || "",
      permasalahan: report.permasalahan || "",
      solusi: report.solusi || "",
      tglSelesai: report.tglSelesai || "",
      keterangan: report.keterangan || "",
    });
    setMessage(null);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get("edit");
    if (!reportId || loading) return;
    const report = reports.find((item) => item.id === reportId);
    if (!report) return;

    startEditing(report);
    params.delete("edit");
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`
    );
  }, [loading, reports]);

  function closeEditor() {
    if (saving) return;
    setEditingReport(null);
    setForm(emptyReport);
  }

  function resetFilters() {
    setSearch("");
    setMonthFilter("all");
    setApplicationFilter("all");
    setMenuFilter("all");
    setStatusFilter("all");
  }

  const hasActiveFilters = Boolean(search || monthFilter !== "all" || applicationFilter !== "all" ||
    menuFilter !== "all" || statusFilter !== "all");

  function toggleDateSort(field) {
    setDateSort((current) => ({
      field,
      direction: current?.field === field && current.direction === 1 ? -1 : 1,
    }));
    setPage(1);
  }

  async function handleNormalizeGroup(group) {
    const selectedVariants = selectedSimilarVariants[group.key] || [];
    const selectedCounts = group.variantCounts.filter(({ value }) => selectedVariants.includes(value));
    const preferredValue = [...selectedCounts].sort(
      (left, right) => right.count - left.count || left.value.localeCompare(right.value, "id")
    )[0]?.value;
    const canonicalValue = selectedVariants.includes(selectedSimilarValues[group.key])
      ? selectedSimilarValues[group.key]
      : preferredValue;
    if (selectedVariants.length < 2 || !selectedVariants.includes(canonicalValue)) return;
    const selectedReports = group.reports.filter((report) => selectedVariants.includes(report[group.field]));
    const columnName = group.field === "aplikasi" ? "Nama Aplikasi & Daerah" : "Menu";
    const variantSummary = selectedVariants.map((value) => `• ${value}`).join("\n");
    if (!(await confirm({
      title: "Samakan format data?",
      message: `Samakan ${selectedReports.length} laporan pada kolom ${columnName} menjadi “${canonicalValue}”?\n\nVariasi yang dipilih: ${variantSummary}\n\nVariasi lain tidak akan diubah. Perubahan pada spreadsheet tidak dapat dibatalkan otomatis.`,
      confirmLabel: "Samakan data",
    }))) return;

    setNormalizingGroup(group.key);
    setMessage(null);
    try {
      const settings = readGoogleSettings(session?.user?.email);
      const response = await apiFetch("/api/log/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: group.field,
          variants: selectedVariants,
          canonicalValue,
          expectedReports: selectedReports,
          spreadsheetId: settings?.spreadsheetId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Format data serupa gagal disamakan.");
      setMessage({
        type: "success",
        text: `${data.updatedCount} laporan pada kolom ${columnName} disamakan menjadi “${canonicalValue}”.${data.borderWarning ? ` ${data.borderWarning}` : ""}`,
      });
      await loadReports();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Format data serupa gagal disamakan." });
    } finally {
      setNormalizingGroup(null);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!editingReport || form.tglSelesai < form.tglMulai) return;
    setSaving(true);
    setMessage(null);
    try {
      const settings = readGoogleSettings(session?.user?.email);
      const response = await apiFetch(`/api/log/${encodeURIComponent(editingReport.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          expected: editingReport,
          spreadsheetId: settings?.spreadsheetId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Laporan gagal diperbarui.");
      window.dispatchEvent(new Event("daily-worklog:counts-updated"));
      setEditingReport(null);
      setForm(emptyReport);
      setMessage({
        type: "success",
        text: `Laporan berhasil diperbarui di spreadsheet.${data.borderWarning ? ` ${data.borderWarning}` : ""}`,
      });
      await loadReports();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Laporan gagal diperbarui." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(report) {
    if (!(await confirm({
      title: "Hapus laporan?",
      message: `Laporan “${report.aplikasi || "Tanpa nama"}” pada ${formatDate(report.tglMulai)} akan dihapus dari spreadsheet. Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: "Hapus laporan",
      danger: true,
    }))) return;
    setDeletingId(report.id);
    setMessage(null);
    try {
      const settings = readGoogleSettings(session?.user?.email);
      const response = await apiFetch(`/api/log/${encodeURIComponent(report.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected: report, spreadsheetId: settings?.spreadsheetId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Laporan gagal dihapus.");
      window.dispatchEvent(new Event("daily-worklog:counts-updated"));
      if (editingReport?.id === report.id) closeEditor();
      setMessage({
        type: "success",
        text: `Laporan berhasil dihapus dari spreadsheet.${data.borderWarning ? ` ${data.borderWarning}` : ""}`,
      });
      await loadReports();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Laporan gagal dihapus." });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page-content report-manager">
      <section className="page-intro">
        <div>
          <p className="page-eyebrow"><span />Data</p>
          <h1>Kelola <em>laporan.</em></h1>
          <p className="page-subtitle">Edit atau hapus laporan tersimpan.</p>
        </div>
      </section>

      <ActionToast
        message={normalizingGroup
          ? { type: "progress", text: "Menyamakan format laporan di spreadsheet..." }
          : saving
            ? { type: "progress", text: "Menyimpan perubahan laporan..." }
            : deletingId
              ? { type: "progress", text: "Menghapus laporan dari spreadsheet..." }
              : message}
        onClose={() => setMessage(null)}
      />

      <section className="dashboard-panel report-manager-panel" aria-labelledby="report-manager-heading">
        <div className="dashboard-panel-heading report-manager-heading">
          <div>
            <span className="panel-eyebrow">Laporan tersimpan</span>
            <h2 id="report-manager-heading">Laporan tersimpan</h2>
          </div>
          <button type="button" className="text-button" onClick={() => void loadReports()} disabled={loading} aria-busy={loading}>
            {loading ? "Memuat..." : "Muat ulang"}
          </button>
        </div>

        <div className="report-manager-filters">
          <label className="dashboard-filter report-manager-search">
            <span>Cari laporan</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Aplikasi, menu, kendala, solusi..."
            />
          </label>
          <label className="dashboard-filter">
            <span>Bulan laporan</span>
            <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
              <option value="all">Semua bulan</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {monthFormatter.format(new Date(`${month}-01T00:00:00Z`))}
                </option>
              ))}
            </select>
          </label>
          <label className="dashboard-filter">
            <span>Aplikasi & daerah</span>
            <select
              value={applicationFilter}
              onChange={(event) => {
                setApplicationFilter(event.target.value);
                setMenuFilter("all");
              }}
            >
              <option value="all">Semua aplikasi</option>
              {applications.map((application) => <option key={application} value={application}>{application}</option>)}
            </select>
          </label>
          <label className="dashboard-filter">
            <span>Menu</span>
            <select value={menuFilter} onChange={(event) => setMenuFilter(event.target.value)}>
              <option value="all">Semua menu</option>
              {menus.map((menu) => <option key={menu} value={menu}>{menu}</option>)}
            </select>
          </label>
          <label className="dashboard-filter">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Semua status</option>
              <option value="completed">Selesai</option>
              <option value="pending">Tertunda</option>
            </select>
          </label>
          <button
            type="button"
            className="filter-reset-button report-filter-reset"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            title={hasActiveFilters ? "Hapus semua filter laporan" : "Tidak ada filter aktif"}
          >
            <Icon name="reset" size={15} />
            <span>Reset filter</span>
          </button>
        </div>

        {!loading && !loadError && (
          <div className="similar-tools-actions">
            <button
              type="button"
              className="similar-tools-toggle"
              aria-expanded={showSimilarTools}
              aria-controls="similar-values-tools"
              onClick={() => setShowSimilarTools((visible) => !visible)}
            >
              {showSimilarTools ? "Tutup" : "Rapikan data serupa"}
            </button>
          </div>
        )}

        {!loading && !loadError && showSimilarTools && (
          <section id="similar-values-tools" className="similar-values-panel" aria-labelledby="similar-values-heading">
            <div className="similar-values-heading">
              <div>
                <span className="panel-eyebrow">Perapihan data</span>
                <h3 id="similar-values-heading">Nama atau menu serupa</h3>
                <p>Pilih nilai yang ingin disamakan. Nilai lain tetap.</p>
              </div>
              <span className="similar-values-count">{similarGroups.length} kelompok</span>
            </div>
            <label className="similar-values-search">
              <span>Cari nama aplikasi atau menu serupa</span>
              <input
                type="search"
                value={similarValueSearch}
                onChange={(event) => setSimilarValueSearch(event.target.value)}
                placeholder="Contoh: Siskeudes TNT Bali"
              />
            </label>
            {(() => {
              const query = similarValueSearch.trim().toLocaleLowerCase("id-ID");
              const visibleGroups = similarGroups.filter((group) =>
                !query || group.variants.some((variant) => variant.toLocaleLowerCase("id-ID").includes(query))
              );
              if (!visibleGroups.length) {
                return (
                  <p className="similar-values-empty" role="status">
                    Tidak ada kelompok serupa yang cocok dengan pencarian “{similarValueSearch}”.
                  </p>
                );
              }
              return (
                <div className="similar-values-list">
                  {visibleGroups.map((group) => {
                    const columnName = group.field === "aplikasi" ? "Nama aplikasi & daerah" : "Menu";
                    const selectedVariants = selectedSimilarVariants[group.key] || [];
                    const selectedCounts = group.variantCounts.filter(({ value }) => selectedVariants.includes(value));
                    const preferredValue = [...selectedCounts].sort(
                      (left, right) => right.count - left.count || left.value.localeCompare(right.value, "id")
                    )[0]?.value;
                    const selectedValue = selectedVariants.includes(selectedSimilarValues[group.key])
                      ? selectedSimilarValues[group.key]
                      : preferredValue || "";
                    return (
                      <article className="similar-value-group" key={group.key}>
                        <div className="similar-value-details">
                          <span>{columnName}</span>
                          <div className="similar-value-variants">
                            {group.variantCounts.map(({ value, count }) => (
                              <label className="similar-value-variant" key={value}>
                                <input
                                  type="checkbox"
                                  checked={selectedVariants.includes(value)}
                                  onChange={(event) => setSelectedSimilarVariants((current) => {
                                    const currentValues = current[group.key] || [];
                                    return {
                                      ...current,
                                      [group.key]: event.target.checked
                                        ? [...currentValues, value]
                                        : currentValues.filter((item) => item !== value),
                                    };
                                  })}
                                  disabled={normalizingGroup !== null}
                                />
                                <span>{value} <small>{count} laporan</small></span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <label className="similar-value-choice">
                          <span>Gunakan format terpilih</span>
                          <select
                            value={selectedValue}
                            onChange={(event) => setSelectedSimilarValues((current) => ({
                              ...current,
                              [group.key]: event.target.value,
                            }))}
                            disabled={normalizingGroup !== null || selectedVariants.length < 2}
                          >
                            {selectedVariants.map((variant) => (
                              <option key={variant} value={variant}>{variant}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="page-button similar-value-apply"
                          onClick={() => void handleNormalizeGroup(group)}
                          disabled={normalizingGroup !== null || selectedVariants.length < 2}
                          aria-busy={normalizingGroup === group.key}
                        >
                          {normalizingGroup === group.key ? "Menyamakan..." : "Samakan"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              );
            })()}
          </section>
        )}

        {loading ? (
          <div className="dashboard-state" role="status">Memuat laporan...</div>
        ) : loadError ? (
          <div className="dashboard-state dashboard-error" role="alert">
            <strong>Laporan tidak dapat dimuat</strong>
            <span>{loadError}</span>
          </div>
        ) : filteredReports.length ? (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th aria-sort={dateSort?.field === "tglMulai" ? (dateSort.direction === 1 ? "ascending" : "descending") : "none"}>
                    <button type="button" className="report-sort-button" onClick={() => toggleDateSort("tglMulai")}>
                      Tanggal mulai <Icon name={dateSort?.field === "tglMulai" ? (dateSort.direction === 1 ? "sortUp" : "sortDown") : "sort"} size={13} />
                    </button>
                  </th>
                  <th>Aplikasi & daerah</th>
                  <th>Menu</th>
                  <th>Permasalahan</th>
                  <th aria-sort={dateSort?.field === "tglSelesai" ? (dateSort.direction === 1 ? "ascending" : "descending") : "none"}>
                    <button type="button" className="report-sort-button" onClick={() => toggleDateSort("tglSelesai")}>
                      Tanggal selesai <Icon name={dateSort?.field === "tglSelesai" ? (dateSort.direction === 1 ? "sortUp" : "sortDown") : "sort"} size={13} />
                    </button>
                  </th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReports.map((report) => (
                  <tr key={report.id}>
                    <td>{formatDate(report.tglMulai)}</td>
                    <td className="report-app">{report.aplikasi || "—"}</td>
                    <td>{report.menu || "—"}</td>
                    <td className="report-issue" title={report.permasalahan}>{report.permasalahan || "—"}</td>
                    <td>{report.tglSelesai ? formatDate(report.tglSelesai) : "—"}</td>
                    <td>
                      <span className={`report-status ${report.tglSelesai ? "is-complete" : "is-open"}`}>
                        {report.tglSelesai ? "Selesai" : "Tertunda"}
                      </span>
                    </td>
                    <td>
                      <div className="report-row-actions">
                        <button
                          type="button"
                          className="report-view-action"
                          onClick={() => setViewingReport(report)}
                          aria-label={`Lihat detail ${report.aplikasi || "laporan"}`}
                          title="Lihat detail"
                        >
                          <Icon name="eye" size={15} />
                          <span>Detail</span>
                        </button>
                        <button
                          type="button"
                          className="report-edit-action"
                          onClick={() => startEditing(report)}
                          disabled={loading || deletingId !== null}
                          aria-label={`Edit ${report.aplikasi || "laporan"}`}
                          title="Edit laporan"
                        >
                          <Icon name="edit" size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="report-delete-action"
                          onClick={() => void handleDelete(report)}
                          disabled={loading || deletingId !== null}
                          aria-busy={deletingId === report.id}
                          aria-label={`${deletingId === report.id ? "Menghapus" : "Hapus"} ${report.aplikasi || "laporan"}`}
                          title="Hapus laporan"
                        >
                          {deletingId !== report.id && <Icon name="trash" size={14} />}
                          <span>{deletingId === report.id ? "Menghapus..." : "Hapus"}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="chart-empty">
            {reports.length ? "Tidak ada laporan yang cocok dengan filter." : "Belum ada laporan di spreadsheet."}
          </div>
        )}
        <div className="report-pagination" aria-label="Navigasi halaman laporan">
          <span className="pagination-summary">
            Menampilkan {firstVisibleRow}–{lastVisibleRow} dari {sortedReports.length} laporan
          </span>
          <div className="pagination-controls">
            <label className="page-size-control">
              <span>Baris per halaman</span>
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <button
              type="button"
              className="page-button"
              onClick={() => setPage(1)}
              disabled={currentPage <= 1}
              aria-label="Halaman pertama"
            >
              Awal
            </button>
            <button
              type="button"
              className="page-button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              aria-label="Halaman sebelumnya"
            >
              Sebelumnya
            </button>
            <span className="page-indicator">Halaman {currentPage} dari {Math.max(1, pageCount)}</span>
            <button
              type="button"
              className="page-button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={currentPage >= pageCount}
              aria-label="Halaman berikutnya"
            >
              Berikutnya
            </button>
            <button
              type="button"
              className="page-button"
              onClick={() => setPage(pageCount)}
              disabled={currentPage >= pageCount}
              aria-label="Halaman terakhir"
            >
              Akhir
            </button>
          </div>
        </div>
        <p className="report-manager-count">{sortedReports.length} dari {reports.length} laporan</p>
      </section>

      <ReportDetailDialog report={viewingReport} onClose={() => setViewingReport(null)} />

      {editingReport && (
        <div className="report-editor-backdrop" onClick={closeEditor}>
          <section
            className="report-editor-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-editor-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="report-editor-heading">
              <div>
                <span className="panel-eyebrow">Edit spreadsheet</span>
                <h2 id="report-editor-heading">Perbarui laporan</h2>
              </div>
              <button type="button" className="image-lightbox-close report-editor-close" onClick={closeEditor} aria-label="Tutup form edit">
                <Icon name="close" size={18} />
              </button>
            </div>
            {message?.type === "error" && (
              <p className="form-message error" role="alert">
                <span className="message-mark" aria-hidden="true">!</span>
                {message.text}
              </p>
            )}
            <form className="report-editor-form" onSubmit={handleSave}>
              <label className="field">
                <span className="field-label">Nama Aplikasi & Daerah <span className="required-mark">*</span></span>
                <input className="field-control" value={form.namaAplikasiDaerah} onChange={(event) => setForm({ ...form, namaAplikasiDaerah: event.target.value })} required />
              </label>
              <label className="field">
                <span className="field-label">Menu <span className="required-mark">*</span></span>
                <input className="field-control" value={form.menu} onChange={(event) => setForm({ ...form, menu: event.target.value })} required />
              </label>
              <WorkStatusToggle
                value={form.tglSelesai ? "completed" : "pending"}
                onChange={(status) => {
                  const today = todayAsInputValue();
                  setForm({
                    ...form,
                    tglSelesai: status === "pending"
                      ? ""
                      : form.tglSelesai || (form.tglMulai > today ? form.tglMulai : today),
                  });
                }}
              />
              <div className="field-grid">
                <label className="field">
                  <span className="field-label">Tanggal mulai <span className="required-mark">*</span></span>
                  <input className="field-control" type="date" value={form.tglMulai} onChange={(event) => setForm({ ...form, tglMulai: event.target.value })} required />
                </label>
                <label className="field">
                  <span className="field-label">Tanggal selesai</span>
                  <input className="field-control" type="date" value={form.tglSelesai} min={form.tglMulai || undefined} onChange={(event) => setForm({ ...form, tglSelesai: event.target.value })} />
                </label>
              </div>
              {form.tglMulai && form.tglSelesai && form.tglSelesai < form.tglMulai && (
                <p className="field-error" role="alert">Tanggal selesai tidak boleh lebih awal dari tanggal mulai.</p>
              )}
              <label className="field">
                <span className="field-label">Permasalahan <span className="required-mark">*</span></span>
                <textarea className="field-control" rows={3} value={form.permasalahan} onChange={(event) => setForm({ ...form, permasalahan: event.target.value })} required />
              </label>
              <label className="field">
                <span className="field-label">Solusi / tindak lanjut <span className="required-mark">*</span></span>
                <textarea className="field-control" rows={3} value={form.solusi} onChange={(event) => setForm({ ...form, solusi: event.target.value })} required />
              </label>
              <label className="field">
                <span className="field-label">Keterangan</span>
                <textarea className="field-control" rows={2} value={form.keterangan} onChange={(event) => setForm({ ...form, keterangan: event.target.value })} />
              </label>
              <div className="report-editor-actions">
                <button type="button" className="page-button" onClick={closeEditor} disabled={saving}>Batal</button>
                <button type="submit" className="submit-button" disabled={saving || form.tglSelesai < form.tglMulai} aria-busy={saving}>
                  {saving ? "Menyimpan..." : "Simpan perubahan"}
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
    </div>
  );
}
