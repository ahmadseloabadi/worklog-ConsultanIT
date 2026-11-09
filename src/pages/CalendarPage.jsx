import { useEffect, useMemo, useState } from "react";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import Icon from "@/components/Icon";
import { signIn, useSession } from "@/lib/auth";
import { loadNotesTodos, NOTES_TODOS_SPREADSHEET_ID } from "@/lib/notesTodos";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function displayDate(value) {
  const date = parseDateKey(value);
  return date
    ? new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date)
    : value;
}

function calendarItem(item, type) {
  const date = parseDateKey(item.dueDate) ? item.dueDate : String(item.createdAt || "").slice(0, 10);
  if (!parseDateKey(date)) return null;
  return {
    ...item,
    type,
    date,
  };
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const email = session?.user?.email;
    setItems([]);
    setError("");
    if (!email) return undefined;

    async function load() {
      setLoading(true);
      try {
        const [notes, todos] = await Promise.all([
          loadNotesTodos(email, "notes", NOTES_TODOS_SPREADSHEET_ID),
          loadNotesTodos(email, "todos", NOTES_TODOS_SPREADSHEET_ID),
        ]);
        if (cancelled) return;
        setItems([
          ...notes.items.map((item) => calendarItem(item, "notes")),
          ...todos.items.map((item) => calendarItem(item, "todos")),
        ].filter(Boolean));
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Aktivitas kalender tidak dapat dimuat.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [session?.user?.email]);

  const itemsByDate = useMemo(() => {
    const grouped = new Map();
    for (const item of items) {
      if (!grouped.has(item.date)) grouped.set(item.date, []);
      grouped.get(item.date).push(item);
    }
    return grouped;
  }, [items]);

  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      return { date, key: dateKey(date), inMonth: date.getMonth() === month.getMonth() };
    });
  }, [month]);

  const selectedItems = itemsByDate.get(selectedDate) || [];
  const todayKey = dateKey(new Date());

  function changeMonth(offset) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function showToday() {
    const today = new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(dateKey(today));
  }

  return (
    <main className="app-shell">
      <AppHeader />
      <div className="page-content">
        <section className="page-intro notes-intro">
          <div>
            <p className="page-eyebrow"><span />Jadwal aktivitas</p>
            <h1>Kalender <em>aktivitas.</em></h1>
            <p className="page-subtitle">Lihat catatan dan To Do berdasarkan tanggal yang tersimpan.</p>
          </div>
          {session?.user?.email && <span className="notes-account">{session.user.email}</span>}
        </section>
        {session && (
          <p className="notes-spreadsheet-note">
            Kalender membaca data dari spreadsheet bersama. Pastikan akun ini memiliki akses Editor.
            {" "}<a href={`https://docs.google.com/spreadsheets/d/${NOTES_TODOS_SPREADSHEET_ID}/edit`} target="_blank" rel="noreferrer">Buka spreadsheet</a>
          </p>
        )}

        {status === "loading" ? (
          <div className="state-panel" role="status">Memuat status akun...</div>
        ) : !session ? (
          <section className="auth-panel">
            <div className="auth-mark" aria-hidden="true">WL</div>
            <div>
              <p className="auth-eyebrow">Akses workspace</p>
              <h2>Masuk untuk melihat kalender</h2>
              <p>Kalender menampilkan aktivitas yang tersimpan di spreadsheet akun Anda.</p>
            </div>
            <button className="session-button sign-in-button" onClick={() => signIn("google")}>Masuk dengan Google</button>
          </section>
        ) : (
          <>
            {error && <div className="notes-message is-error" role="alert">{error}</div>}
            <section className="calendar-panel">
              <header className="calendar-toolbar">
                <div>
                  <span className="summary-eyebrow">Kalender aktivitas</span>
                  <h2>{MONTHS[month.getMonth()]} {month.getFullYear()}</h2>
                </div>
                <div className="calendar-navigation">
                  <button type="button" className="clear-form-button" onClick={showToday}>Hari ini</button>
                  <button type="button" className="notes-icon-button" onClick={() => changeMonth(-1)} aria-label="Bulan sebelumnya" title="Bulan sebelumnya">
                    <Icon name="arrowLeft" size={17} />
                  </button>
                  <button type="button" className="notes-icon-button" onClick={() => changeMonth(1)} aria-label="Bulan berikutnya" title="Bulan berikutnya">
                    <Icon name="chevronRight" size={17} />
                  </button>
                </div>
              </header>

              {loading ? (
                <div className="state-panel" role="status">Memuat aktivitas...</div>
              ) : (
                <div className="calendar-layout">
                  <div className="calendar-grid" role="grid" aria-label={`${MONTHS[month.getMonth()]} ${month.getFullYear()}`}>
                    {WEEKDAYS.map((day) => <div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
                    {calendarDays.map(({ date, key, inMonth }) => {
                      const dayItems = itemsByDate.get(key) || [];
                      return (
                        <button
                          type="button"
                          role="gridcell"
                          aria-label={`${displayDate(key)}, ${dayItems.length} aktivitas`}
                          aria-pressed={selectedDate === key}
                          className={`calendar-day${inMonth ? "" : " is-outside"}${selectedDate === key ? " is-selected" : ""}${key === todayKey ? " is-today" : ""}`}
                          key={key}
                          onClick={() => setSelectedDate(key)}
                        >
                          <span className="calendar-day-number">{date.getDate()}</span>
                          {dayItems.length > 0 && (
                            <span className="calendar-day-items">
                              {dayItems.slice(0, 3).map((item) => (
                                <span className={`calendar-event-chip is-${item.type}`} key={item.id}>
                                  <span>{item.type === "todos" ? "Tugas" : "Catatan"}</span>
                                  {item.title || "Tanpa judul"}
                                </span>
                              ))}
                              {dayItems.length > 3 && <span className="calendar-more">+{dayItems.length - 3} lainnya</span>}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <aside className="calendar-day-detail">
                    <div className="calendar-detail-heading">
                      <span className="summary-eyebrow">Aktivitas tanggal</span>
                      <h3>{displayDate(selectedDate)}</h3>
                    </div>
                    {!selectedItems.length ? (
                      <div className="notes-empty calendar-empty">
                        <Icon name="calendar" size={22} />
                        <p>Tidak ada aktivitas tersimpan pada tanggal ini.</p>
                      </div>
                    ) : (
                      <div className="calendar-activity-list">
                        {selectedItems.map((item) => (
                          <article className={`calendar-activity is-${item.type}`} key={`${item.type}-${item.id}`}>
                            <span>{item.type === "todos" ? "To Do" : "Catatan"}</span>
                            <h4>{item.title || "Tanpa judul"}</h4>
                            {item.type === "todos" && <small>{item.status}</small>}
                            {item.dueDate && <small>Tanggal aktivitas: {item.dueDate}</small>}
                          </article>
                        ))}
                      </div>
                    )}
                  </aside>
                </div>
              )}
              <div className="calendar-legend">
                <span><i className="is-notes" /> Catatan</span>
                <span><i className="is-todos" /> To Do</span>
                <p>Item tanpa tanggal khusus ditampilkan pada tanggal dibuat.</p>
              </div>
            </section>
          </>
        )}
      </div>
      <AppFooter />
    </main>
  );
}
