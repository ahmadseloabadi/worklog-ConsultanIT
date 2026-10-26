
import { signIn, signOut, useSession } from "@/lib/auth";
import { Link, NavLink, useLocation } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { getSavedDrafts } from "@/lib/draftStorage";
import { readGoogleSettings } from "@/lib/googleSettings";
import Icon from "@/components/Icon";
import { useEffect, useState } from "react";

const sidebarCountCache = new Map();
const SIDEBAR_COUNT_CACHE_MS = 15_000;

export default function AppHeader() {
  const { data: session, status, tokenExpired, error: authMessage } = useSession();
  const { pathname } = useLocation();
  const [profileImage, setProfileImage] = useState("");
  const [draftCount, setDraftCount] = useState(null);
  const [pendingCount, setPendingCount] = useState(null);
  const [countError, setCountError] = useState(false);
  const [activitiesOpen, setActivitiesOpen] = useState(pathname === "/laporan baru" || pathname === "/pending");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("daily-worklog-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const imageUrl = session?.user?.image || "";
  const userKey = session?.user?.email?.toLowerCase() || session?.user?.id || "";
  const pageTitle = {
    "/laporan baru": "Laporan baru",
    "/pending": "Laporan tertunda",
    "/dashboard": "Dashboard",
    "/reports": "Laporan",
    "/setup": "Setup Google",
  }[pathname] || "Daily Worklog";

  useEffect(() => {
    if (pathname === "/laporan baru" || pathname === "/pending") setActivitiesOpen(true);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("sidebar-collapsed", sidebarCollapsed);
    try {
      localStorage.setItem("daily-worklog-sidebar-collapsed", String(sidebarCollapsed));
    } catch (error) {
      console.error("Preferensi sidebar tidak dapat disimpan.", error);
    }
    return () => document.body.classList.remove("sidebar-collapsed");
  }, [sidebarCollapsed]);

  useEffect(() => {
    let cancelled = false;

    async function refreshCounts(force = false) {
      setCountError(false);
      const settings = session?.user?.email ? readGoogleSettings(session.user.email) : null;
      const cacheKey = `${session?.user?.email?.toLowerCase() || "guest"}:${settings?.spreadsheetId || "none"}`;
      const cached = sidebarCountCache.get(cacheKey);
      if (!force && cached && Date.now() - cached.updatedAt < SIDEBAR_COUNT_CACHE_MS) {
        setDraftCount(cached.draftCount);
        setPendingCount(cached.pendingCount);
        return;
      }

      let currentDraftCount = null;
      try {
        const drafts = await getSavedDrafts();
        currentDraftCount = drafts.length;
        if (!cancelled) setDraftCount(currentDraftCount);
      } catch (error) {
        console.error("Jumlah draft tidak dapat dimuat.", error);
        if (!cancelled) {
          setDraftCount(null);
          setCountError(true);
        }
      }

      if (!session?.user?.email) {
        sidebarCountCache.set(cacheKey, {
          draftCount: currentDraftCount,
          pendingCount: 0,
          updatedAt: Date.now(),
        });
        if (!cancelled) setPendingCount(0);
        return;
      }

      if (!settings?.spreadsheetId) {
        sidebarCountCache.set(cacheKey, {
          draftCount: currentDraftCount,
          pendingCount: 0,
          updatedAt: Date.now(),
        });
        if (!cancelled) setPendingCount(0);
        return;
      }

      try {
        const response = await apiFetch(`/api/dashboard?spreadsheetId=${encodeURIComponent(settings.spreadsheetId)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal memuat jumlah laporan tertunda.");
        if (!Array.isArray(data.worklogs)) throw new Error("Format data laporan tidak valid.");
        const counts = {
          draftCount: currentDraftCount,
          pendingCount: data.worklogs.filter((item) => !item.tglSelesai).length,
          updatedAt: Date.now(),
        };
        sidebarCountCache.set(cacheKey, counts);
        if (!cancelled) {
          setDraftCount(counts.draftCount);
          setPendingCount(counts.pendingCount);
        }
      } catch (error) {
        console.error("Jumlah laporan tertunda tidak dapat dimuat.", error);
        if (!cancelled) {
          setPendingCount(null);
          setCountError(true);
        }
      }
    }

    if (status !== "loading") void refreshCounts();
    const handleCountsUpdated = () => void refreshCounts(true);
    window.addEventListener("daily-worklog:counts-updated", handleCountsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("daily-worklog:counts-updated", handleCountsUpdated);
    };
  }, [pathname, session?.user?.email, status]);

  useEffect(() => {
    setProfileImage("");
    if (!imageUrl || !userKey) return;

    const cacheKey = `daily-worklog-profile-image:${userKey}`;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached?.url === imageUrl) {
        if (cached.dataUrl) setProfileImage(cached.dataUrl);
        if (cached.dataUrl || cached.retryAfter > Date.now()) return;
      }
    } catch {}

    let cancelled = false;
    async function cacheProfileImage() {
      try {
        const response = await fetch(imageUrl, { cache: "force-cache", mode: "cors" });
        if (!response.ok) throw new Error("Foto profil tidak tersedia.");
        const imageBlob = await response.blob();
        if (!imageBlob.type.startsWith("image/") || imageBlob.size > 512 * 1024) {
          throw new Error("Ukuran atau format foto profil tidak valid.");
        }
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(imageBlob);
        });
        if (cancelled) return;
        localStorage.setItem(cacheKey, JSON.stringify({ url: imageUrl, dataUrl }));
        setProfileImage(dataUrl);
      } catch {
        if (!cancelled) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify({
              url: imageUrl,
              unavailable: true,
              retryAfter: Date.now() + 60 * 60 * 1000,
            }));
          } catch {
            // Keep the initials fallback if browser storage is unavailable.
          }
        }
      }
    }

    void cacheProfileImage();
    return () => { cancelled = true; };
  }, [imageUrl, userKey]);

  return (
    <>
      <aside className={`workspace-sidebar${sidebarCollapsed ? " is-collapsed" : ""}`}>
        <Link to="/dashboard" className="brand-link" aria-label="Daily Worklog beranda">
          <span className="brand-symbol" aria-hidden="true">W</span>
          <span className="brand-copy">
            <span className="brand-overline">SELO · WORKLOG</span>
            <strong>Daily Worklog</strong>
          </span>
        </Link>

        <span className="sidebar-section-label">Menu</span>
        <nav className="main-navigation" aria-label="Navigasi utama">
          <NavLink aria-label="Dashboard" to="/dashboard" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            <Icon name="dashboard" className="sidebar-nav-icon" />
            <span>Dashboard</span>
          </NavLink>
          <div className={`nav-group${pathname === "/laporan baru" || pathname === "/pending" ? " has-active-child" : ""}`}>
            <button
              type="button"
              className="nav-link nav-group-toggle"
              aria-label="Aktivitas"
              aria-expanded={activitiesOpen}
              aria-controls="activity-submenu"
              onClick={() => setActivitiesOpen((open) => !open)}
            >
              <Icon name="activity" className="sidebar-nav-icon" />
              <span>Aktivitas</span>
              <Icon name="chevronDown" className={`nav-chevron${activitiesOpen ? " is-open" : ""}`} size={16} />
            </button>
            {activitiesOpen && (
              <div className="nav-submenu" id="activity-submenu">
                <NavLink aria-label={`Input laporan, ${draftCount ?? "jumlah tidak diketahui"} draft sementara`} end to="/laporan baru" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
                  <Icon name="plus" className="sidebar-subnav-marker" size={16} />
                  <span>Input laporan</span>
                  <span className="nav-badge" aria-label={`${draftCount ?? "tidak diketahui"} draft sementara`}>
                    {draftCount ?? "—"}
                  </span>
                </NavLink>
                <NavLink aria-label={`Laporan tertunda, ${pendingCount ?? "jumlah tidak diketahui"} laporan`} to="/pending" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
                  <Icon name="clock" className="sidebar-subnav-marker" size={16} />
                  <span>Laporan tertunda</span>
                  <span className="nav-badge is-pending" aria-label={`${pendingCount ?? "tidak diketahui"} laporan tertunda`}>
                    {pendingCount ?? "—"}
                  </span>
                </NavLink>
              </div>
            )}
          </div>
          <NavLink aria-label="Laporan" to="/reports" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            <Icon name="reports" className="sidebar-nav-icon" />
            <span>Laporan</span>
          </NavLink>
          <NavLink aria-label="Setup Google" to="/setup" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            <Icon name="settings" className="sidebar-nav-icon" />
            <span>Setup Google</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <span className="connection-dot" />
          <span>{session ? "Google tersambung" : "Masuk untuk sinkronisasi"}</span>
          {countError && <span className="sidebar-count-error" role="status">Jumlah laporan tidak dapat dimuat.</span>}
          <span className="sidebar-copyright"><strong>© {new Date().getFullYear()} AHMAD SELO ABADI</strong></span>
        </div>
      </aside>

      <header className="workspace-mainbar">
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={sidebarCollapsed ? "Buka sidebar" : "Tutup sidebar"}
          aria-expanded={!sidebarCollapsed}
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
        >
          <Icon name={sidebarCollapsed ? "panelOpen" : "panelClose"} size={18} />
        </button>
        {/* <div className="mainbar-title">
          <span>SELO · WORKLOG</span>
          <strong>{pageTitle}</strong>
        </div> */}
        <div className="topbar-actions">
          {authMessage && <span className="session-loading" role="alert">{authMessage}</span>}
          {status === "loading" ? (
            <span className="session-loading">Memeriksa sesi</span>
          ) : session ? (
            <div className="user-controls">
              <div className="user-avatar" aria-hidden="true">
                {profileImage ? (
                  <img src={profileImage} alt="" />
                ) : (
                  (session.user.name || session.user.email || "U").slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="user-copy">
                <strong>{session.user.name}</strong>
                <span>{session.user.email}</span>
              </div>
              {tokenExpired && (
                <button className="session-button sign-in-button" onClick={() => signIn("google")}>
                  Sambungkan ulang
                </button>
              )}
              <button className="session-button" onClick={() => signOut()}>Keluar</button>
            </div>
          ) : (
            <span className="session-loading">Belum masuk</span>
          )}
        </div>
      </header>
    </>
  );
}
