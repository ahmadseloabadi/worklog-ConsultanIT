import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import Icon from "@/components/Icon";
import { createCalendarEvent, updateCalendarEvent } from "@/lib/googleClient";
import {
  DEFAULT_FIELDS,
  NOTES_TODOS_SPREADSHEET_ID,
  TODO_STATUSES,
  deleteNotesTodosItem,
  loadNotesTodos,
  saveNotesTodosFields,
  saveNotesTodosItem,
} from "@/lib/notesTodos";
import { requestCalendarAccess, signIn, useSession } from "@/lib/auth";

const FIELD_TYPES = [
  { value: "text", label: "Teks singkat" },
  { value: "textarea", label: "Teks panjang" },
  { value: "date", label: "Tanggal" },
  { value: "select", label: "Pilihan" },
  { value: "checkbox", label: "Checkbox" },
];

function createFieldId() {
  return crypto.randomUUID();
}

function calendarPayload(item, fields) {
  const date = item.dueDate;
  if (!date) throw new Error("Tambahkan field tanggal pada form dan isi tanggal jatuh tempo terlebih dahulu.");
  const summary = item.title || "To Do";
  const details = fields
    .filter((field) => field.type !== "checkbox" && item.values[field.id])
    .map((field) => `${field.label}: ${item.values[field.id]}`)
    .join("\n");
  const nextDay = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(nextDay.getTime()) || nextDay.toISOString().slice(0, 10) !== date) {
    throw new Error("Tanggal To Do tidak valid.");
  }
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return {
    summary,
    description: details,
    start: { date },
    end: { date: nextDay.toISOString().slice(0, 10) },
  };
}

export default function NotesTodosPage() {
  const { data: session, status } = useSession();
  const { pathname } = useLocation();
  const type = pathname === "/todos" ? "todos" : "notes";
  const [fields, setFields] = useState(DEFAULT_FIELDS.notes);
  const [items, setItems] = useState([]);
  const [values, setValues] = useState({});
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyItem, setBusyItem] = useState("");
  const [draggedItemId, setDraggedItemId] = useState("");
  const [message, setMessage] = useState(null);

  const titleField = useMemo(
    () => fields.find((field) => field.type !== "checkbox"),
    [fields]
  );

  useEffect(() => {
    let cancelled = false;
    const email = session?.user?.email;
    setItems([]);
    setFields(DEFAULT_FIELDS[type]);
    setValues({});
    setEditing(null);
    setMessage(null);
    if (!email) return undefined;

    async function load() {
      setLoading(true);
      try {
        const result = await loadNotesTodos(email, type, NOTES_TODOS_SPREADSHEET_ID);
        if (cancelled) return;
        setFields(result.fields);
        setItems(result.items);
      } catch (error) {
        if (!cancelled) setMessage({ type: "error", text: error.message || "Data tidak dapat dimuat." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [session?.user?.email, type]);

  function updateField(fieldId, patch) {
    setFields((current) => current.map((field) => field.id === fieldId ? { ...field, ...patch } : field));
  }

  function moveField(index, direction) {
    setFields((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSaveFields() {
    if (!session?.user?.email) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveNotesTodosFields(session.user.email, type, NOTES_TODOS_SPREADSHEET_ID, fields);
      setFields(saved);
      setMessage({ type: "success", text: "Struktur form kustom berhasil disimpan." });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Form tidak dapat disimpan." });
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!session?.user?.email) return;
    if (!fields.length) {
      setMessage({ type: "error", text: "Tambahkan minimal satu field sebelum menyimpan." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const savedFields = await saveNotesTodosFields(session.user.email, type, NOTES_TODOS_SPREADSHEET_ID, fields);
      setFields(savedFields);
      const item = await saveNotesTodosItem(
        session.user.email,
        type,
        NOTES_TODOS_SPREADSHEET_ID,
        savedFields,
        values,
        editing
      );
      setItems((current) => editing
        ? current.map((existing) => existing.id === item.id ? item : existing)
        : [item, ...current]);
      setValues({});
      setEditing(null);
      setMessage({ type: "success", text: `${type === "notes" ? "Catatan" : "To Do"} berhasil disimpan.` });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Data tidak dapat disimpan." });
    } finally {
      setSaving(false);
    }
  }

  function startEditing(item) {
    setEditing(item);
    setValues(Object.fromEntries(fields.map((field) => [field.id, item.values[field.id] ?? (field.type === "checkbox" ? false : "")])));
    setMessage(null);
  }

  async function handleDelete(item) {
    if (!session?.user?.email) return;
    setBusyItem(item.id);
    setMessage(null);
    try {
      await deleteNotesTodosItem(session.user.email, type, NOTES_TODOS_SPREADSHEET_ID, item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (editing?.id === item.id) {
        setEditing(null);
        setValues({});
      }
      setMessage({ type: "success", text: "Item berhasil dihapus." });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Item tidak dapat dihapus." });
    } finally {
      setBusyItem("");
    }
  }

  async function handleMoveStatus(item, nextStatus) {
    if (!session?.user?.email) return;
    if (!TODO_STATUSES.includes(nextStatus) || item.status === nextStatus) return;
    setBusyItem(item.id);
    setMessage(null);
    try {
      const nextValues = { ...item.values, __status: nextStatus, __done: nextStatus === "Selesai" };
      const updated = await saveNotesTodosItem(
        session.user.email,
        type,
        NOTES_TODOS_SPREADSHEET_ID,
        fields,
        nextValues,
        { ...item, status: nextStatus, done: nextStatus === "Selesai" }
      );
      setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Status To Do tidak dapat diperbarui." });
    } finally {
      setBusyItem("");
    }
  }

  async function handleDropStatus(itemId, statusName) {
    const item = items.find((entry) => entry.id === itemId);
    setDraggedItemId("");
    if (item) await handleMoveStatus(item, statusName);
  }

  async function handleCalendar(item) {
    if (!session?.user?.email) return;
    setBusyItem(item.id);
    setMessage(null);
    try {
      await requestCalendarAccess();
      const eventPayload = calendarPayload(item, fields);
      const event = item.calendarEvent?.id
        ? await updateCalendarEvent(item.calendarEvent.id, eventPayload)
        : await createCalendarEvent(eventPayload);
      const updated = await saveNotesTodosItem(
        session.user.email,
        type,
        NOTES_TODOS_SPREADSHEET_ID,
        fields,
        item.values,
        { ...item, calendarEvent: { id: event.id, htmlLink: event.htmlLink } }
      );
      setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
      setMessage({ type: "success", text: "To Do berhasil disinkronkan ke Google Calendar." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Google Calendar tidak dapat diakses. Pastikan Calendar API aktif di Google Cloud.",
      });
    } finally {
      setBusyItem("");
    }
  }

  return (
    <main className="app-shell">
      <AppHeader />
      <div className="page-content">
        <section className="page-intro notes-intro">
          <div>
            <p className="page-eyebrow"><span />Workspace pribadi</p>
            <h1>{type === "notes" ? <>Catatan <em>pribadi.</em></> : <>Papan <em>To Do.</em></>}</h1>
            <p className="page-subtitle">{type === "notes" ? "Simpan ide dan sesuaikan form sesuai cara kerja Anda." : "Atur pekerjaan dalam papan yang bisa dipindahkan antarstatus."}</p>
          </div>
          {session?.user?.email && <span className="notes-account">{session.user.email}</span>}
        </section>
        {message && (
          <div className={`notes-message is-${message.type}`} role={message.type === "error" ? "alert" : "status"}>
            {message.text}
            <button type="button" onClick={() => setMessage(null)} aria-label="Tutup pesan">
              <Icon name="close" size={15} />
            </button>
          </div>
        )}

        {status === "loading" ? (
          <div className="state-panel" role="status">Memuat status akun...</div>
        ) : !session ? (
          <section className="auth-panel">
            <div className="auth-mark" aria-hidden="true">WL</div>
            <div>
              <p className="auth-eyebrow">Akses workspace</p>
              <h2>Masuk untuk membuka {type === "notes" ? "Catatan" : "To Do"}</h2>
              <p>Data akan tersimpan di spreadsheet yang terhubung ke akun Google Anda.</p>
            </div>
            <button className="session-button sign-in-button" onClick={() => signIn("google")}>
              Masuk dengan Google
            </button>
          </section>
        ) : (
          <>
            <div className={`notes-workspace${type === "todos" ? " is-todos" : ""}`}>
              <section className="notes-editor-card">
                <div className="notes-card-heading">
                  <div>
                    <span className="summary-eyebrow">{editing ? "Ubah item" : "Buat baru"}</span>
                    <h2>{type === "notes" ? "Catatan baru" : "Tugas baru"}</h2>
                  </div>
                  <details className="notes-customizer">
                    <summary><Icon name="settings" size={16} /> Kustomisasi form</summary>
                    <div className="notes-customizer-content">
                      <p>Atur nama, tipe, urutan, dan field wajib pada form ini. Perubahan disimpan untuk akun Anda.</p>
                      {fields.map((field, index) => (
                        <div className="notes-field-config" key={field.id}>
                          <label>
                            <span>Nama field</span>
                            <input
                              className="field-control"
                              value={field.label}
                              onChange={(event) => updateField(field.id, { label: event.target.value })}
                              maxLength={60}
                            />
                          </label>
                          <label>
                            <span>Tipe</span>
                            <select
                              className="field-control"
                              value={field.type}
                              onChange={(event) => updateField(field.id, {
                                type: event.target.value,
                                options: event.target.value === "select" ? field.options || ["Pilihan 1"] : field.options,
                              })}
                            >
                              {FIELD_TYPES.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                            </select>
                          </label>
                          {field.type === "select" && (
                            <label className="notes-field-options">
                              <span>Pilihan (pisahkan dengan koma)</span>
                              <input
                                className="field-control"
                                value={(field.options || []).join(", ")}
                                onChange={(event) => updateField(field.id, {
                                  options: event.target.value.split(",").map((option) => option.trim()),
                                })}
                              />
                            </label>
                          )}
                          <label className="notes-required">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(event) => updateField(field.id, { required: event.target.checked })}
                            />
                            Wajib
                          </label>
                          <div className="notes-field-actions">
                            <button type="button" className="text-button" onClick={() => moveField(index, -1)} disabled={index === 0} aria-label="Pindah ke atas">↑</button>
                            <button type="button" className="text-button" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1} aria-label="Pindah ke bawah">↓</button>
                            <button type="button" className="text-button" onClick={() => setFields((current) => current.filter((entry) => entry.id !== field.id))}>Hapus</button>
                          </div>
                        </div>
                      ))}
                      <div className="notes-customizer-actions">
                        <button
                          type="button"
                          className="clear-form-button"
                          onClick={() => setFields((current) => current.length >= 20
                            ? current
                            : [...current, { id: createFieldId(), label: "Field baru", type: "text", required: false }])}
                          disabled={fields.length >= 20}
                        >
                          <Icon name="plus" size={15} /> Tambah field
                        </button>
                        <button type="button" className="submit-button" onClick={handleSaveFields} disabled={saving}>
                          {saving ? "Menyimpan..." : "Simpan form"}
                        </button>
                      </div>
                    </div>
                  </details>
                </div>

                <form onSubmit={handleSubmit}>
                  {fields.map((field) => (
                    <label className="field" key={field.id}>
                      <span className="field-label">
                        {field.label}{field.required && <span className="required-mark"> *</span>}
                      </span>
                      {field.type === "textarea" ? (
                        <textarea
                          className="field-control field-textarea"
                          value={values[field.id] || ""}
                          onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                          required={field.required}
                        />
                      ) : field.type === "select" ? (
                        <select
                          className="field-control"
                          value={values[field.id] || ""}
                          onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                          required={field.required}
                        >
                          <option value="">Pilih...</option>
                          {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : field.type === "checkbox" ? (
                        <span className="notes-checkbox-control">
                          <input
                            type="checkbox"
                            checked={Boolean(values[field.id])}
                            onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.checked }))}
                            required={field.required}
                          />
                          <span>{field.label}</span>
                        </span>
                      ) : (
                        <input
                          className="field-control"
                          type={field.type === "date" ? "date" : "text"}
                          value={values[field.id] || ""}
                          onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                          required={field.required}
                        />
                      )}
                    </label>
                  ))}
                  {!fields.length && <p className="notes-empty-fields">Tambahkan setidaknya satu field melalui Kustomisasi form.</p>}
                  <div className="notes-form-actions">
                    {editing && (
                      <button type="button" className="clear-form-button" onClick={() => { setEditing(null); setValues({}); }}>
                        Batal
                      </button>
                    )}
                    <button className="submit-button" type="submit" disabled={saving || !fields.length} aria-busy={saving}>
                      {saving ? "Menyimpan..." : editing ? "Simpan perubahan" : type === "notes" ? "Simpan catatan" : "Simpan To Do"}
                    </button>
                  </div>
                </form>
              </section>

              <section className={`notes-list-section${type === "todos" ? " is-kanban" : ""}`}>
                <div className="notes-list-heading">
                  <div>
                    <span className="summary-eyebrow">Tersimpan di spreadsheet</span>
                    <h2>{type === "notes" ? "Catatan Anda" : "Papan tugas"}</h2>
                  </div>
                  <span className="notes-count">{items.length}</span>
                </div>
                {loading ? (
                  <div className="state-panel" role="status">Memuat data...</div>
                ) : type === "notes" && !items.length ? (
                  <div className="notes-empty">
                    <Icon name="documents" size={24} />
                    <p>Belum ada catatan. Mulai dengan form di samping.</p>
                  </div>
                ) : type === "notes" ? (
                  <div className="notes-item-list">
                    {items.map((item) => (
                      <article className="notes-item" key={item.id}>
                        <div className="notes-item-content">
                          <h3>{item.title || "Tanpa judul"}</h3>
                          {fields.filter((field) => field.id !== titleField?.id && item.values[field.id] !== undefined && item.values[field.id] !== "").map((field) => (
                            <p className="notes-item-detail" key={field.id}>
                              <strong>{field.label}:</strong> {field.type === "checkbox" ? (item.values[field.id] ? "Ya" : "Tidak") : item.values[field.id]}
                            </p>
                          ))}
                          {item.dueDate && <span className="notes-item-date">Jatuh tempo {item.dueDate}</span>}
                        </div>
                        <div className="notes-item-actions">
                          <button type="button" className="notes-icon-button" onClick={() => startEditing(item)} aria-label={`Edit ${item.title}`} title="Edit">
                            <Icon name="edit" size={16} />
                          </button>
                          <button type="button" className="notes-icon-button is-danger" onClick={() => handleDelete(item)} disabled={busyItem === item.id} aria-label={`Hapus ${item.title}`} title="Hapus">
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="todo-board">
                    {TODO_STATUSES.map((statusName) => {
                      const statusItems = items.filter((item) => item.status === statusName);
                      return (
                        <section
                          className="todo-column"
                          key={statusName}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            void handleDropStatus(event.dataTransfer.getData("text/plain") || draggedItemId, statusName);
                          }}
                        >
                          <header className="todo-column-heading">
                            <h3>{statusName}</h3>
                            <span>{statusItems.length}</span>
                          </header>
                          <div className="todo-column-cards">
                            {statusItems.map((item) => (
                              <article
                                className={`todo-card${item.status === "Selesai" ? " is-done" : ""}${draggedItemId === item.id ? " is-dragging" : ""}`}
                                key={item.id}
                                draggable={busyItem !== item.id}
                                onDragStart={(event) => {
                                  setDraggedItemId(item.id);
                                  event.dataTransfer.effectAllowed = "move";
                                  event.dataTransfer.setData("text/plain", item.id);
                                }}
                                onDragEnd={() => setDraggedItemId("")}
                              >
                                <div className="todo-card-topline">
                                  <span className={`todo-priority-dot is-${String(item.values["todo-priority"] || "normal").toLowerCase()}`} />
                                  <select
                                    className="todo-card-status"
                                    aria-label={`Status ${item.title}`}
                                    value={item.status}
                                    disabled={busyItem === item.id}
                                    onChange={(event) => void handleMoveStatus(item, event.target.value)}
                                  >
                                    {TODO_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
                                  </select>
                                </div>
                                <h4>{item.title || "Tanpa judul"}</h4>
                                {fields.filter((field) => field.id !== titleField?.id && item.values[field.id] !== undefined && item.values[field.id] !== "").map((field) => (
                                  <p className="notes-item-detail" key={field.id}>
                                    {field.type === "checkbox"
                                      ? <><strong>{field.label}:</strong> {item.values[field.id] ? "Ya" : "Tidak"}</>
                                      : item.values[field.id]}
                                  </p>
                                ))}
                                {item.dueDate && <span className="notes-item-date">Jatuh tempo {item.dueDate}</span>}
                                {item.calendarEvent?.htmlLink && (
                                  <a className="notes-calendar-link" href={item.calendarEvent.htmlLink} target="_blank" rel="noreferrer">
                                    Buka di Google Calendar
                                  </a>
                                )}
                                <footer className="todo-card-footer">
                                  <span className="todo-drag-hint" aria-hidden="true">⠿ Geser kartu</span>
                                  <div className="notes-item-actions">
                                    {item.dueDate && (
                                      <button type="button" className="notes-icon-button" onClick={() => handleCalendar(item)} disabled={busyItem === item.id} title={item.calendarEvent ? "Perbarui acara Google Calendar" : "Tambahkan ke Google Calendar"} aria-label={item.calendarEvent ? "Perbarui acara Google Calendar" : "Tambahkan ke Google Calendar"}>
                                        <Icon name="calendar" size={16} />
                                      </button>
                                    )}
                                    <button type="button" className="notes-icon-button" onClick={() => startEditing(item)} aria-label={`Edit ${item.title}`} title="Edit">
                                      <Icon name="edit" size={15} />
                                    </button>
                                    <button type="button" className="notes-icon-button is-danger" onClick={() => handleDelete(item)} disabled={busyItem === item.id} aria-label={`Hapus ${item.title}`} title="Hapus">
                                      <Icon name="trash" size={15} />
                                    </button>
                                  </div>
                                </footer>
                              </article>
                            ))}
                            {!statusItems.length && <p className="todo-column-empty">Lepas kartu di sini atau buat tugas baru.</p>}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
      <AppFooter />
    </main>
  );
}
