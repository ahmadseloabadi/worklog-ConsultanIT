
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { readGoogleSettings } from "@/lib/googleSettings";
import { ActionToast } from "@/components/ActionFeedback";
import ReportDetailDialog from "@/components/ReportDetailDialog";
import Icon from "@/components/Icon";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat("id-ID", { month: "short" });
const monthYearFormatter = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });
const loadedAtFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function asDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value) {
  const date = asDate(value);
  return date ? dateFormatter.format(date) : "Tanggal tidak tersedia";
}

function getMonthKey(value) {
  return value ? value.slice(0, 7) : "";
}

function formatMonth(value) {
  if (!value) return "";
  const [year, month] = value.split("-").map(Number);
  return monthYearFormatter.format(new Date(year, month - 1, 1));
}

function normalizeText(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

export default function Dashboard() {
  const { data: session } = useSession();
  const [worklogs, setWorklogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshFeedback, setRefreshFeedback] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);
  const [monthFilter, setMonthFilter] = useState("all");
  const [blockerPage, setBlockerPage] = useState(1);
  const [applicationIssuePage, setApplicationIssuePage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [application, setApplication] = useState("all");
  const [menu, setMenu] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tableSearch, setTableSearch] = useState("");
  const [tableStartDate, setTableStartDate] = useState("");
  const [tableEndDate, setTableEndDate] = useState("");
  const [tableApplication, setTableApplication] = useState("all");
  const [tableMenu, setTableMenu] = useState("all");
  const [tableStatus, setTableStatus] = useState("all");
  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tableSort, setTableSort] = useState({ field: "tglMulai", direction: -1 });
  const hasDashboardFilters = monthFilter !== "all" || Boolean(startDate || endDate) ||
    application !== "all" || menu !== "all" || statusFilter !== "all";
  const hasTableFilters = Boolean(tableSearch || tableStartDate || tableEndDate) ||
    tableApplication !== "all" || tableMenu !== "all" || tableStatus !== "all";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    if (refreshKey > 0) setRefreshFeedback(null);
    const settings = readGoogleSettings(session?.user?.email);
    if (!settings?.spreadsheetId) {
      setError("Selesaikan setup Google terlebih dahulu.");
      setLoading(false);
      return () => { cancelled = true; };
    }
    apiFetch(`/api/dashboard?spreadsheetId=${encodeURIComponent(settings.spreadsheetId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal memuat data dashboard.");
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setWorklogs(Array.isArray(data.worklogs) ? data.worklogs : []);
          setRefreshedAt(new Date());
          if (refreshKey > 0) setRefreshFeedback({ type: "success", text: "Data dashboard berhasil diperbarui." });
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const text = fetchError.message || "Gagal memuat data dashboard.";
          setError(text);
          if (refreshKey > 0) setRefreshFeedback({ type: "error", text });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey, session?.user?.email]);

  const availableMonths = useMemo(() => [...new Set(worklogs
    .map((item) => getMonthKey(item.tglMulai))
    .filter(Boolean))].sort((a, b) => b.localeCompare(a)), [worklogs]);

  useEffect(() => {
    if (monthFilter !== "all" && !availableMonths.includes(monthFilter)) {
      setMonthFilter("all");
    }
  }, [availableMonths, monthFilter]);

  const applications = useMemo(
    () => [...new Set(worklogs.map((item) => item.aplikasi).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")),
    [worklogs]
  );
  const menus = useMemo(
    () => [...new Set(worklogs
      .filter((item) => application === "all" || item.aplikasi === application)
      .map((item) => item.menu)
      .filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")),
    [application, worklogs]
  );
  const tableMenus = useMemo(
    () => [...new Set(worklogs
      .filter((item) => tableApplication === "all" || item.aplikasi === tableApplication)
      .map((item) => item.menu)
      .filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")),
    [tableApplication, worklogs]
  );

  const filteredByOtherFilters = useMemo(() => worklogs.filter((item) => {
    if (!item.tglMulai || (startDate && item.tglMulai < startDate) || (endDate && item.tglMulai > endDate)) return false;
    if (statusFilter === "completed" && !item.tglSelesai) return false;
    if (statusFilter === "ongoing" && item.tglSelesai) return false;
    if (statusFilter === "issues" && !item.permasalahan.trim()) return false;
    return true;
  }), [endDate, startDate, statusFilter, worklogs]);
  const priorityFiltered = useMemo(
    () => filteredByOtherFilters.filter((item) =>
      (monthFilter === "all" || getMonthKey(item.tglMulai) === monthFilter) &&
      (menu === "all" || item.menu === menu)
    ),
    [filteredByOtherFilters, menu, monthFilter]
  );
  const filtered = useMemo(
    () => priorityFiltered.filter((item) => application === "all" || item.aplikasi === application),
    [application, priorityFiltered]
  );
  const activityFiltered = useMemo(
    () => filteredByOtherFilters.filter((item) =>
      (application === "all" || item.aplikasi === application) &&
      (menu === "all" || item.menu === menu)
    ),
    [application, filteredByOtherFilters, menu]
  );

  const metrics = useMemo(() => {
    const completed = filtered.filter((item) => item.tglSelesai).length;
    const withIssues = filtered.filter((item) => item.permasalahan.trim()).length;
    const resolutionDurations = filtered
      .filter((item) => item.tglSelesai)
      .map((item) => Math.round((asDate(item.tglSelesai) - asDate(item.tglMulai)) / 86400000))
      .filter((days) => Number.isFinite(days) && days >= 0);
    return {
      total: filtered.length,
      completed,
      withIssues,
      completionRate: filtered.length ? Math.round((completed / filtered.length) * 100) : 0,
      averageResolutionDays: resolutionDurations.length
        ? Math.round(resolutionDurations.reduce((total, days) => total + days, 0) / resolutionDurations.length)
        : null,
    };
  }, [filtered]);

  const monthlyActivity = useMemo(() => {
    const counts = new Map();
    activityFiltered.forEach((item) => {
      const date = asDate(item.tglMulai);
      if (!date) return;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const existing = counts.get(key) || { year: date.getFullYear(), month: date.getMonth(), count: 0 };
      existing.count += 1;
      counts.set(key, existing);
    });
    return [...counts.values()]
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .slice(-12);
  }, [activityFiltered]);

  const applicationIssues = useMemo(() => {
    const counts = new Map();
    priorityFiltered.forEach((item) => {
      const name = item.aplikasi.trim() || "Tanpa nama aplikasi";
      const current = counts.get(name) || { name, total: 0, issueCount: 0 };
      current.total += 1;
      if (item.permasalahan.trim()) current.issueCount += 1;
      counts.set(name, current);
    });
    return [...counts.values()]
      .filter((item) => item.issueCount > 0)
      .map((item) => ({ ...item, issueRate: Math.round((item.issueCount / item.total) * 100) }))
      .sort((a, b) => b.issueCount - a.issueCount || b.issueRate - a.issueRate || a.name.localeCompare(b.name, "id"))
  }, [priorityFiltered]);

  const blockers = useMemo(() => {
    const counts = new Map();
    filtered.filter((item) => item.permasalahan.trim()).forEach((item) => {
      const text = item.permasalahan.trim().replace(/\s+/g, " ");
      const key = normalizeText(text);
      const current = counts.get(key) || { text, count: 0 };
      current.count += 1;
      counts.set(key, current);
    });
    return [...counts.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, "id"));
  }, [filtered]);

  const tableRows = useMemo(() => {
    const query = normalizeText(tableSearch);
    return [...worklogs]
      .filter((item) => {
        if (monthFilter !== "all" && getMonthKey(item.tglMulai) !== monthFilter) return false;
        if (tableStartDate && item.tglMulai < tableStartDate) return false;
        if (tableEndDate && item.tglMulai > tableEndDate) return false;
        if (tableApplication !== "all" && item.aplikasi !== tableApplication) return false;
        if (tableMenu !== "all" && item.menu !== tableMenu) return false;
        if (tableStatus === "completed" && !item.tglSelesai) return false;
        if (tableStatus === "ongoing" && item.tglSelesai) return false;
        if (tableStatus === "issues" && !item.permasalahan.trim()) return false;
        if (query && !normalizeText([
          item.aplikasi,
          item.menu,
          item.permasalahan,
          item.solusi,
          item.keterangan,
          item.tglMulai,
          item.tglSelesai,
        ].join(" ")).includes(query)) return false;
        return true;
      })
      .sort((left, right) => {
        const leftValue = tableSort.field === "status"
          ? (left.tglSelesai ? "Selesai" : "Tertunda")
          : left[tableSort.field] || "";
        const rightValue = tableSort.field === "status"
          ? (right.tglSelesai ? "Selesai" : "Tertunda")
          : right[tableSort.field] || "";
        if (!leftValue && !rightValue) return 0;
        if (!leftValue) return 1;
        if (!rightValue) return -1;
        return leftValue.localeCompare(rightValue, "id") * tableSort.direction;
      });
  }, [monthFilter, tableApplication, tableEndDate, tableMenu, tableSearch, tableSort, tableStartDate, tableStatus, worklogs]);
  const pageCount = Math.ceil(tableRows.length / pageSize);
  const currentPage = Math.min(tablePage, Math.max(1, pageCount));
  const firstVisibleRow = tableRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastVisibleRow = Math.min(currentPage * pageSize, tableRows.length);
  const paginatedRows = tableRows.slice(firstVisibleRow - 1, lastVisibleRow);
  const maxMonthlyActivity = Math.max(1, ...monthlyActivity.map((item) => item.count));
  const maxBlockerCount = Math.max(1, ...blockers.map((item) => item.count));
  const maxApplicationIssueCount = Math.max(1, ...applicationIssues.map((item) => item.issueCount));
  const blockerPageCount = Math.ceil(blockers.length / 5);
  const applicationIssuePageCount = Math.ceil(applicationIssues.length / 5);
  const visibleBlockers = blockers.slice((blockerPage - 1) * 5, blockerPage * 5);
  const visibleApplicationIssues = applicationIssues.slice((applicationIssuePage - 1) * 5, applicationIssuePage * 5);

  useEffect(() => {
    setBlockerPage(1);
    setApplicationIssuePage(1);
  }, [application, endDate, menu, monthFilter, startDate, statusFilter]);

  useEffect(() => {
    setBlockerPage((current) => Math.min(current, Math.max(1, blockerPageCount)));
  }, [blockerPageCount]);

  useEffect(() => {
    setApplicationIssuePage((current) => Math.min(current, Math.max(1, applicationIssuePageCount)));
  }, [applicationIssuePageCount]);

  useEffect(() => {
    setTablePage(1);
  }, [monthFilter, pageSize, tableApplication, tableEndDate, tableMenu, tableSearch, tableStartDate, tableStatus]);

  function toggleTableSort(field) {
    setTableSort((current) => ({
      field,
      direction: current.field === field ? -current.direction : 1,
    }));
    setTablePage(1);
  }

  function resetFilters() {
    setMonthFilter("all");
    setStartDate("");
    setEndDate("");
    setApplication("all");
    setMenu("all");
    setStatusFilter("all");
  }

  function resetTableFilters() {
    setTableSearch("");
    setTableStartDate("");
    setTableEndDate("");
    setTableApplication("all");
    setTableMenu("all");
    setTableStatus("all");
    setTablePage(1);
  }

  return (
    <div className="dashboard-content">
      <section className="page-intro dashboard-intro">
        <div>
          <p className="page-eyebrow"><span />Ringkasan</p>
          <h1>Dashboard <em>aktivitas.</em></h1>
          <p className="page-subtitle">Pantau progres, kendala, dan laporan tertunda.</p>
        </div>
        <div className="dashboard-live-group">
          <div className="dashboard-live">
            <span />Data Google Sheets
            {refreshedAt && <small>Diperbarui {loadedAtFormatter.format(refreshedAt)}</small>}
          </div>
          <button
            type="button"
            className="dashboard-refresh-button"
            onClick={() => setRefreshKey((current) => current + 1)}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Memuat..." : "Muat ulang"}
          </button>
        </div>
      </section>
      <ActionToast
        message={refreshKey > 0 && loading
          ? { type: "progress", text: "Memuat ulang laporan dari Google Sheets..." }
          : refreshFeedback}
        onClose={() => setRefreshFeedback(null)}
      />

      <section className="dashboard-filters" aria-label="Filter dashboard">
        {error && (
          <div className="state-panel" role="alert">
            {error} <Link to="/setup">Buka Setup Google</Link>
          </div>
        )}
        <div className="filter-heading">
          <div>
            <strong>Filter laporan</strong>
            <span>Atur periode dan aktivitas</span>
          </div>
          <button
            type="button"
            className="filter-reset-button"
            onClick={resetFilters}
            disabled={!hasDashboardFilters}
            title={hasDashboardFilters ? "Hapus semua filter dashboard" : "Tidak ada filter aktif"}
          >
            <Icon name="reset" size={15} />
            <span>Reset filter</span>
          </button>
        </div>
        <div className="filter-controls">
          <label className="dashboard-filter">
            <span>Bulan laporan</span>
            <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
              <option value="all">Semua bulan</option>
              {availableMonths.map((item) => <option key={item} value={item}>{formatMonth(item)}</option>)}
            </select>
          </label>
          <label className="dashboard-filter">
            <span>Dari tanggal</span>
            <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="dashboard-filter">
            <span>Sampai tanggal</span>
            <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label className="dashboard-filter">
            <span>Aplikasi & daerah</span>
            <select value={application} onChange={(event) => { setApplication(event.target.value); setMenu("all"); }}>
              <option value="all">Semua aplikasi</option>
              {applications.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="dashboard-filter">
            <span>Menu</span>
            <select value={menu} onChange={(event) => setMenu(event.target.value)}>
              <option value="all">Semua menu</option>
              {menus.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="dashboard-filter">
            <span>Status & kendala</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Semua laporan</option>
              <option value="completed">Selesai</option>
              <option value="ongoing">Tertunda</option>
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <div className="dashboard-state" role="status">Memuat ringkasan laporan...</div>
      ) : error ? (
        <div className="dashboard-state dashboard-error" role="alert">
          <strong>Dashboard tidak dapat dimuat</strong>
          <span>{error}</span>
        </div>
      ) : (
        <>
          <div className="dashboard-results-label">
            <span>{filtered.length} laporan ditampilkan</span>
            <span>
              {monthFilter !== "all" ? formatMonth(monthFilter) : "Semua bulan"}
              {startDate || endDate
                ? ` · ${startDate ? formatDate(startDate) : "Awal"} – ${endDate ? formatDate(endDate) : "Sekarang"}`
                : ""}
            </span>
          </div>
          <section className="kpi-grid" aria-label="Indikator kinerja">
            <article className="kpi-card kpi-total">
              <span className="kpi-label">Total aktivitas</span>
              <strong>{metrics.total}</strong>
              <span className="kpi-caption">sesuai filter</span>
              <span className="kpi-mark" aria-hidden="true">01</span>
            </article>
            <article className="kpi-card kpi-completed">
              <span className="kpi-label">Aktivitas selesai</span>
              <strong>{metrics.completed}</strong>
              <span className="kpi-caption">{metrics.completionRate}% dari laporan</span>
              <span className="kpi-mark" aria-hidden="true">02</span>
            </article>
    
            <article className="kpi-card kpi-open">
              <span className="kpi-label">Tertunda</span>
              <strong>{metrics.total - metrics.completed}</strong>
              <span className="kpi-caption">belum selesai</span>
              <span className="kpi-mark" aria-hidden="true">03</span>
            </article>
            <article className="kpi-card kpi-duration">
              <span className="kpi-label">Rata-rata penyelesaian</span>
              <strong>{metrics.averageResolutionDays ?? "—"}{metrics.averageResolutionDays !== null && <small> hari</small>}</strong>
              <span className="kpi-caption">laporan selesai</span>
              <span className="kpi-mark" aria-hidden="true">04</span>
            </article>
          </section>
          <section className="dashboard-panel activity-panel" aria-label="Tren aktivitas bulanan">
            <div className="dashboard-panel-heading">
              <div>
                <span className="panel-eyebrow">Tren laporan</span>
                <h2>Aktivitas per bulan</h2>
              </div>
              <span className="panel-badge">Klik batang untuk filter</span>
            </div>
            {monthlyActivity.length ? (
              <div className="activity-chart" aria-label="Jumlah aktivitas per bulan">
                {monthlyActivity.map((item) => (
                  <button
                    type="button"
                    className={`activity-column${monthFilter === `${item.year}-${String(item.month + 1).padStart(2, "0")}` ? " is-selected" : ""}`}
                    key={`${item.year}-${item.month}`}
                    title={`Tampilkan ${item.count} laporan pada ${monthFormatter.format(new Date(item.year, item.month, 1))} ${item.year}`}
                    aria-pressed={monthFilter === `${item.year}-${String(item.month + 1).padStart(2, "0")}`}
                    onClick={() => {
                      const key = `${item.year}-${String(item.month + 1).padStart(2, "0")}`;
                      setMonthFilter((current) => current === key ? "all" : key);
                    }}
                  >
                    <span className="activity-value">{item.count}</span>
                    <div className="activity-bar-track">
                      <span style={{ height: `${Math.max(6, (item.count / maxMonthlyActivity) * 100)}%` }} />
                    </div>
                    <span className="activity-month">{monthFormatter.format(new Date(item.year, item.month, 1))} {String(item.year).slice(-2)}</span>
                  </button>
                ))}
              </div>
            ) : <div className="chart-empty">Belum ada aktivitas pada periode ini.</div>}
            <p className="chart-footnote">Grafik membandingkan 12 bulan terakhir sesuai filter aplikasi, menu, status, dan rentang tanggal.</p>
          </section>

          <section className="dashboard-chart-grid">
            <article className="dashboard-panel application-issues-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <span className="panel-eyebrow">Aplikasi prioritas</span>
                  <h2>Aplikasi paling sering terkendala</h2>
                </div>
                <span className="panel-badge">{applicationIssues.length} aplikasi</span>
              </div>
              {applicationIssues.length ? (
                <ol className="application-issue-list">
                  {visibleApplicationIssues.map((item, index) => (
                    <li key={item.name}>
                      <button
                        type="button"
                        className={`application-issue-button${application === item.name ? " is-selected" : ""}`}
                        onClick={() => {
                          setApplication((current) => current === item.name ? "all" : item.name);
                          setMenu("all");
                        }}
                        aria-pressed={application === item.name}
                        title={`Filter laporan ${item.name}`}
                      >
                        <span className="blocker-rank">{String((applicationIssuePage - 1) * 5 + index + 1).padStart(2, "0")}</span>
                        <span className="application-issue-copy">
                          <strong>{item.name}</strong>
                          <span>{item.issueCount} kendala dari {item.total} laporan · {item.issueRate}%</span>
                          <span className="application-issue-track">
                            <i style={{ width: `${(item.issueCount / maxApplicationIssueCount) * 100}%` }} />
                          </span>
                        </span>
                        <span className="application-issue-count">{item.issueCount}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : <div className="chart-empty">Belum ada aplikasi berkendala pada filter ini.</div>}
              <p className="chart-footnote">Pilih aplikasi untuk menyaring indikator dan daftar laporan.</p>
              {applicationIssuePageCount > 1 && (
                <div className="insight-pagination" aria-label="Halaman aplikasi prioritas">
                  <span>{(applicationIssuePage - 1) * 5 + 1}–{Math.min(applicationIssuePage * 5, applicationIssues.length)} dari {applicationIssues.length} aplikasi</span>
                  <div>
                    <button type="button" onClick={() => setApplicationIssuePage((page) => Math.max(1, page - 1))} disabled={applicationIssuePage === 1}>Sebelumnya</button>
                    <span>{applicationIssuePage} / {applicationIssuePageCount}</span>
                    <button type="button" onClick={() => setApplicationIssuePage((page) => Math.min(applicationIssuePageCount, page + 1))} disabled={applicationIssuePage === applicationIssuePageCount}>Berikutnya</button>
                  </div>
                </div>
              )}
            </article>

            <article className="dashboard-panel blockers-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <span className="panel-eyebrow">Pola kendala</span>
                  <h2>Kendala yang sering muncul</h2>
                </div>
                <span className="panel-badge">{blockers.length} jenis kendala</span>
              </div>
              {blockers.length ? (
                <ol className="blocker-list">
                  {visibleBlockers.map((item, index) => (
                    <li key={`${normalizeText(item.text)}-${index}`}>
                      <button
                        type="button"
                        className="blocker-select"
                        onClick={() => {
                          setTableSearch(item.text);
                          document.getElementById("dashboard-reports")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        title="Tampilkan laporan dengan kendala ini"
                      >
                        <span className="blocker-rank">{String((blockerPage - 1) * 5 + index + 1).padStart(2, "0")}</span>
                        <span className="blocker-text">{item.text}</span>
                        <strong>{item.count}×</strong>
                      </button>
                      <div className="blocker-track"><span style={{ width: `${(item.count / maxBlockerCount) * 100}%` }} /></div>
                    </li>
                  ))}
                </ol>
              ) : <div className="chart-empty">Tidak ada kendala yang tercatat pada filter ini.</div>}
              <p className="chart-footnote">Pilih kendala untuk melihat laporan terkait.</p>
              {blockerPageCount > 1 && (
                <div className="insight-pagination" aria-label="Halaman pola kendala">
                  <span>{(blockerPage - 1) * 5 + 1}–{Math.min(blockerPage * 5, blockers.length)} dari {blockers.length} kendala</span>
                  <div>
                    <button type="button" onClick={() => setBlockerPage((page) => Math.max(1, page - 1))} disabled={blockerPage === 1}>Sebelumnya</button>
                    <span>{blockerPage} / {blockerPageCount}</span>
                    <button type="button" onClick={() => setBlockerPage((page) => Math.min(blockerPageCount, page + 1))} disabled={blockerPage === blockerPageCount}>Berikutnya</button>
                  </div>
                </div>
              )}
            </article>
          </section>

          <section className="dashboard-panel recent-panel" id="dashboard-reports">
            <div className="dashboard-panel-heading recent-heading">
              <div>
                <span className="panel-eyebrow">Data spreadsheet</span>
                <h2>Semua laporan kerja</h2>
              </div>
              <span className="panel-badge">{tableRows.length} dari {worklogs.length} laporan</span>
            </div>
            <div className="report-filters" aria-label="Filter data laporan">
              <label className="dashboard-filter report-search-filter">
                <span>Cari di semua kolom</span>
                <input
                  type="search"
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                  placeholder="Aplikasi, menu, kendala, solusi..."
                />
              </label>
              <label className="dashboard-filter">
                <span>Dari tanggal</span>
                <input type="date" value={tableStartDate} max={tableEndDate || undefined} onChange={(event) => setTableStartDate(event.target.value)} />
              </label>
              <label className="dashboard-filter">
                <span>Sampai tanggal</span>
                <input type="date" value={tableEndDate} min={tableStartDate || undefined} onChange={(event) => setTableEndDate(event.target.value)} />
              </label>
              <label className="dashboard-filter">
                <span>Aplikasi & daerah</span>
                <select value={tableApplication} onChange={(event) => { setTableApplication(event.target.value); setTableMenu("all"); }}>
                  <option value="all">Semua aplikasi</option>
                  {applications.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="dashboard-filter">
                <span>Menu</span>
                <select value={tableMenu} onChange={(event) => setTableMenu(event.target.value)}>
                  <option value="all">Semua menu</option>
                  {tableMenus.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="dashboard-filter">
                <span>Status</span>
                <select value={tableStatus} onChange={(event) => setTableStatus(event.target.value)}>
                  <option value="all">Semua status</option>
                  <option value="completed">Selesai</option>
                  <option value="ongoing">Tertunda</option>
                </select>
              </label>
              <button
                type="button"
                className="filter-reset-button report-reset-button"
                onClick={resetTableFilters}
                disabled={!hasTableFilters}
                title={hasTableFilters ? "Hapus semua filter tabel" : "Tidak ada filter aktif"}
              >
                <Icon name="reset" size={15} />
                <span>Reset filter</span>
              </button>
            </div>
            {tableRows.length ? (
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th aria-sort={tableSort.field === "tglMulai" ? (tableSort.direction === 1 ? "ascending" : "descending") : "none"}>
                        <button type="button" className="report-sort-button" onClick={() => toggleTableSort("tglMulai")}>
                          Tanggal mulai <Icon name={tableSort.field === "tglMulai" ? (tableSort.direction === 1 ? "sortUp" : "sortDown") : "sort"} size={13} />
                        </button>
                      </th>
                      <th>Aplikasi & daerah</th>
                      <th>Menu</th>
                      <th>Permasalahan</th>
                      <th>Solusi</th>
                      <th aria-sort={tableSort.field === "tglSelesai" ? (tableSort.direction === 1 ? "ascending" : "descending") : "none"}>
                        <button type="button" className="report-sort-button" onClick={() => toggleTableSort("tglSelesai")}>
                          Tanggal selesai <Icon name={tableSort.field === "tglSelesai" ? (tableSort.direction === 1 ? "sortUp" : "sortDown") : "sort"} size={13} />
                        </button>
                      </th>
                      <th>Keterangan</th>
                      <th aria-sort={tableSort.field === "status" ? (tableSort.direction === 1 ? "ascending" : "descending") : "none"}>
                        <button type="button" className="report-sort-button" onClick={() => toggleTableSort("status")}>
                          Status <Icon name={tableSort.field === "status" ? (tableSort.direction === 1 ? "sortUp" : "sortDown") : "sort"} size={13} />
                        </button>
                      </th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.tglMulai)}</td>
                        <td className="report-app">{item.aplikasi || "—"}</td>
                        <td>{item.menu || "—"}</td>
                        <td className="report-issue" title={item.permasalahan}>{item.permasalahan || "—"}</td>
                        <td className="report-issue" title={item.solusi}>{item.solusi || "—"}</td>
                        <td>{item.tglSelesai ? formatDate(item.tglSelesai) : "—"}</td>
                        <td className="report-issue" title={item.keterangan}>{item.keterangan || "—"}</td>
                        <td><span className={item.tglSelesai ? "report-status is-complete" : "report-status is-open"}>{item.tglSelesai ? "Selesai" : "Tertunda"}</span></td>
                        <td>
                          <div className="report-row-actions">
                            <button
                              type="button"
                              className="report-view-action"
                              onClick={() => setViewingReport(item)}
                              aria-label={`Lihat detail ${item.aplikasi || "laporan"}`}
                              title="Lihat detail"
                            >
                              <Icon name="eye" size={15} />
                              <span>Detail</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="chart-empty">Tidak ada laporan yang cocok dengan filter tabel.</div>}
            <div className="report-pagination" aria-label="Navigasi halaman data laporan">
              <span className="pagination-summary">
                Menampilkan {firstVisibleRow}–{lastVisibleRow} dari {tableRows.length} laporan
              </span>
              <div className="pagination-controls">
                <label className="page-size-control">
                  <span>Baris per halaman</span>
                  <select
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="page-button"
                  onClick={() => setTablePage((page) => Math.max(1, page - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Halaman sebelumnya"
                >
                  Sebelumnya
                </button>
                <span className="page-indicator">Halaman {currentPage} dari {Math.max(1, pageCount)}</span>
                <button
                  type="button"
                  className="page-button"
                  onClick={() => setTablePage((page) => Math.min(pageCount, page + 1))}
                  disabled={currentPage >= pageCount}
                  aria-label="Halaman berikutnya"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </section>
        </>
      )}
      <ReportDetailDialog report={viewingReport} onClose={() => setViewingReport(null)} />
    </div>
  );
}
