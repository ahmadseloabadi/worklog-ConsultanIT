
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
  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tableSort, setTableSort] = useState({ field: "tglMulai", direction: -1 });
  const [chartHover, setChartHover] = useState(null);
  const [chartSeries, setChartSeries] = useState("all");
  const hasDashboardFilters = monthFilter !== "all" || Boolean(startDate || endDate) ||
    application !== "all" || menu !== "all" || statusFilter !== "all";

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
    let latestDate = null;
    activityFiltered.forEach((item) => {
      const date = asDate(item.tglMulai);
      if (!date) return;
      if (!latestDate || date > latestDate) latestDate = date;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const existing = counts.get(key) || {
        year: date.getFullYear(), month: date.getMonth(), completed: 0, pending: 0, resolutionDurations: [],
      };
      if (item.tglSelesai) {
        existing.completed += 1;
        const days = Math.round((asDate(item.tglSelesai) - date) / 86400000);
        if (Number.isFinite(days) && days >= 0) existing.resolutionDurations.push(days);
      } else existing.pending += 1;
      counts.set(key, existing);
    });
    if (!latestDate) return [];
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(latestDate.getFullYear(), latestDate.getMonth() - (11 - index), 1);
      const item = counts.get(`${date.getFullYear()}-${date.getMonth()}`) || {
        year: date.getFullYear(), month: date.getMonth(), completed: 0, pending: 0, resolutionDurations: [],
      };
      return {
        ...item,
        year: date.getFullYear(),
        month: date.getMonth(),
        count: item.completed + item.pending,
        total: item.completed + item.pending,
        averageResolutionDays: item.resolutionDurations.length
          ? Math.round(item.resolutionDurations.reduce((total, days) => total + days, 0) / item.resolutionDurations.length)
          : null,
      };
    });
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
    return [...filtered]
      .filter((item) => {
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
  }, [filtered, tableSearch, tableSort]);
  const pageCount = Math.ceil(tableRows.length / pageSize);
  const currentPage = Math.min(tablePage, Math.max(1, pageCount));
  const firstVisibleRow = tableRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastVisibleRow = Math.min(currentPage * pageSize, tableRows.length);
  const paginatedRows = tableRows.slice(firstVisibleRow - 1, lastVisibleRow);
  const maxMonthlyActivity = Math.max(1, ...monthlyActivity.flatMap((item) => [
    item.completed, item.pending, item.total,
  ]));
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
  }, [filtered, pageSize, tableSearch]);

  function toggleTableSort(field) {
    setTableSort((current) => ({
      field,
      direction: current.field === field ? -current.direction : 1,
    }));
    setTablePage(1);
  }

  function resetChartFilters() {
    setChartSeries("all");
    setStatusFilter("all");
    setMonthFilter("all");
  }

  function toggleChartSeries(series) {
    const isActive = chartSeries === series || (chartSeries === "all" && series === "total");
    if (isActive) {
      resetChartFilters();
      return;
    }
    setChartSeries(series);
    setStatusFilter(series === "completed" || series === "average" ? "completed" : series === "pending" ? "ongoing" : "all");
  }

  function toggleChartBar(series, monthKey) {
    const status = series === "completed" || series === "average" ? "completed" : series === "pending" ? "ongoing" : "all";
    if (chartSeries === series && monthFilter === monthKey && statusFilter === status) {
      resetChartFilters();
      return;
    }
    setChartSeries(series);
    setStatusFilter(status);
    setMonthFilter(monthKey);
  }

  function resetFilters() {
    setMonthFilter("all");
    setStartDate("");
    setEndDate("");
    setApplication("all");
    setMenu("all");
    setStatusFilter("all");
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
                <h2>Ringkasan aktivitas bulanan</h2>
              </div>
              <span className="panel-badge">Hover untuk detail · klik legenda untuk fokus</span>
            </div>
            <div className="activity-legend" aria-label="Legenda grafik">
              {[
                ["total", "Total laporan", "#5574a5"],
                ["completed", "Laporan selesai", "#3c8b73"],
                ["pending", "Laporan tertunda", "#d99a39"],
                ["average", "Rata-rata (hari)", "#ad5361"],
              ].map(([series, label, color]) => (
                <button
                  type="button"
                  key={series}
                  className={`activity-legend-button${chartSeries === series || (chartSeries === "all" && series === "total") ? " is-active" : ""}`}
                  aria-pressed={chartSeries === series || (chartSeries === "all" && series === "total")}
                  onClick={() => toggleChartSeries(series)}
                >
                  <span className={`activity-legend-mark is-${series}`} style={{ "--legend-color": color }} />
                  {label}
                </button>
              ))}
            </div>
            {monthlyActivity.length ? (
              <div className="activity-chart-shell">
                <div className="activity-svg-wrap">
                  <svg className="activity-chart activity-chart-svg" viewBox="0 0 960 330" role="img" aria-label="Tren total laporan per bulan">
                  {[0, 0.33, 0.66, 1].map((ratio) => {
                    const y = 150 - ratio * 105;
                    return <g key={ratio}><line x1="54" x2="940" y1={y} y2={y} className="activity-grid-line" /><text x="42" y={y + 4} className="activity-axis-label">{Math.round(maxMonthlyActivity * ratio)}</text></g>;
                  })}
                  <line x1="54" x2="940" y1="150" y2="150" className="activity-center-line" />
                  <text x="14" y="142" className="activity-axis-title" transform="rotate(-90 14 142)">Jumlah laporan</text>
                  {monthlyActivity.map((item, index) => {
                    const center = 82 + index * (823 / Math.max(1, monthlyActivity.length - 1));
                    const totalHeight = item.total ? Math.max(22, (item.total / maxMonthlyActivity) * 105) : 22;
                    const totalY = 150 - totalHeight;
                    const detailMaxHeight = 88;
                    const completedHeight = item.completed ? Math.max(28, (item.completed / maxMonthlyActivity) * detailMaxHeight) : 24;
                    const pendingHeight = item.pending ? Math.max(28, (item.pending / maxMonthlyActivity) * detailMaxHeight) : 24;
                    const averageMax = Math.max(1, ...monthlyActivity.map((entry) => entry.averageResolutionDays || 0));
                    const averageHeight = item.averageResolutionDays === null
                      ? 24
                      : Math.max(28, (item.averageResolutionDays / averageMax) * detailMaxHeight);
                    const monthKey = `${item.year}-${String(item.month + 1).padStart(2, "0")}`;
                    const isHovered = chartHover?.index === index;
                    const isMonthSelected = monthFilter !== "all";
                    const isDimmed = isMonthSelected
                      ? monthFilter !== monthKey
                      : chartHover && !isHovered;
                    return (
                      <g
                        key={`${item.year}-${item.month}`}
                        className={`activity-data-group${isDimmed ? " is-dimmed" : ""}${monthFilter === monthKey ? " is-selected" : ""}`}
                        onMouseEnter={() => setChartHover({ index, x: (center / 960) * 100, top: Math.max(8, (totalY / 330) * 100), item })}
                        onMouseLeave={() => setChartHover(null)}
                        onClick={() => {
                          toggleChartBar("total", monthKey);
                        }}
                        role="button"
                        tabIndex="0"
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            toggleChartBar("total", monthKey);
                          }
                        }}
                        aria-label={`${formatMonth(monthKey)}: ${item.completed} selesai, ${item.pending} tertunda, rata-rata ${item.averageResolutionDays ?? 0} hari`}
                      >
                        <rect x={center - 34} y={totalY} width="68" height={totalHeight} rx="5" className={`activity-total-frame${chartSeries !== "all" && chartSeries !== "total" ? " is-muted" : ""}`} onClick={(event) => { event.stopPropagation(); toggleChartBar("total", monthKey); }} aria-label={`${item.total} total laporan`} />
                        <text x={center} y={totalY + totalHeight / 2 + 5} className={`activity-total-value${chartSeries !== "all" && chartSeries !== "total" ? " is-muted" : ""}`}>{item.total}</text>
                        <circle cx={center} cy={totalY} r="5" className={`activity-total-point${chartSeries !== "all" && chartSeries !== "total" ? " is-muted" : ""}`} />
                        <rect x={center - 34} y="150" width="22" height={completedHeight} rx="5" className={`activity-bar is-completed${chartSeries !== "all" && chartSeries !== "completed" ? " is-muted" : ""}`} onClick={(event) => { event.stopPropagation(); toggleChartBar("completed", monthKey); }} aria-label={`${item.completed} laporan selesai`} />
                        <text x={center - 23} y={167} className={`activity-detail-value${chartSeries !== "all" && chartSeries !== "completed" ? " is-muted" : ""}`}>{item.completed}</text>
                        <rect x={center - 11} y="150" width="22" height={pendingHeight} rx="5" className={`activity-bar is-pending${chartSeries !== "all" && chartSeries !== "pending" ? " is-muted" : ""}`} onClick={(event) => { event.stopPropagation(); toggleChartBar("pending", monthKey); }} aria-label={`${item.pending} laporan tertunda`} />
                        <text x={center} y={167} className={`activity-detail-value${chartSeries !== "all" && chartSeries !== "pending" ? " is-muted" : ""}`}>{item.pending}</text>
                        <rect x={center + 12} y="150" width="22" height={averageHeight} rx="5" className={`activity-bar is-average${chartSeries !== "all" && chartSeries !== "average" ? " is-muted" : ""}`} onClick={(event) => { event.stopPropagation(); toggleChartBar("average", monthKey); }} aria-label={`Rata-rata ${item.averageResolutionDays ?? 0} hari`} />
                        <text x={center + 23} y={167} className={`activity-detail-value${chartSeries !== "all" && chartSeries !== "average" ? " is-muted" : ""}`}>{item.averageResolutionDays ?? 0}</text>
                        <text x={center} y="274" textAnchor="middle" className="activity-month">{monthFormatter.format(new Date(item.year, item.month, 1))} {String(item.year).slice(-2)}</text>
                      </g>
                    );
                  })}
                  <polyline
                    points={monthlyActivity.map((item, index) => {
                    const center = 82 + index * (823 / Math.max(1, monthlyActivity.length - 1));
                      const y = 150 - (item.total ? Math.max(22, (item.total / maxMonthlyActivity) * 105) : 22);
                      return `${center},${y}`;
                    }).join(" ")}
                    className={`activity-line is-focused${chartSeries !== "all" && chartSeries !== "total" ? " is-muted" : ""}`}
                  />
                  </svg>
                  {chartHover && (
                    <div className={`activity-tooltip${chartHover.x > 72 ? " is-right" : ""}`} style={{ left: `${chartHover.x}%`, top: `${chartHover.top}%` }}>
                      <strong>{formatMonth(`${chartHover.item.year}-${String(chartHover.item.month + 1).padStart(2, "0")}`)}</strong>
                      <b>{chartHover.item.total} total laporan</b>
                      <span>{chartHover.item.count} laporan · {chartHover.item.completed} selesai · {chartHover.item.pending} tertunda</span>
                      <span>Rata-rata selesai: {chartHover.item.averageResolutionDays ?? 0} hari</span>
                    </div>
                  )}
                </div>
              </div>
            ) : <div className="chart-empty">Belum ada aktivitas pada periode ini.</div>}
            <p className="chart-footnote">Klik batang atau bulan untuk memfilter laporan. Grafik menampilkan 12 bulan terakhir sesuai filter aplikasi, menu, status, dan rentang tanggal.</p>
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
