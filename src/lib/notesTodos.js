import { getSheetsClient } from "@/lib/googleClient";

export const NOTES_TODOS_SPREADSHEET_ID = "1BLIZ5YU5GaOZrTiRzjMJVb1Pe33gep3QRUBmTDid5mo";
const HEADER = ["ID", "Akun Gmail", "Judul", "Dibuat", "Diperbarui", "Data"];
const ALLOWED_TYPES = new Set(["text", "textarea", "date", "select", "checkbox"]);
export const TODO_STATUSES = ["Belum dimulai", "Sedang dikerjakan", "Selesai"];

export const DEFAULT_FIELDS = {
  notes: [
    { id: "note-title", label: "Judul", type: "text", required: true },
    { id: "note-content", label: "Isi catatan", type: "textarea", required: true },
    { id: "note-tags", label: "Tag", type: "text", required: false },
  ],
  todos: [
    { id: "todo-title", label: "Tugas", type: "text", required: true },
    { id: "todo-details", label: "Detail", type: "textarea", required: false },
    { id: "todo-date", label: "Tanggal jatuh tempo", type: "date", required: false },
    {
      id: "todo-priority",
      label: "Prioritas",
      type: "select",
      options: ["Rendah", "Normal", "Tinggi"],
      required: false,
    },
  ],
};

function normalizeEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Akun Gmail tidak terdeteksi. Silakan masuk kembali.");
  }
  return normalized;
}

function accountSheetName(email, type) {
  const normalized = normalizeEmail(email);
  let hash = 2166136261;
  for (const character of normalized) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const slug = normalized.replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 55);
  return `${type === "notes" ? "CATATAN" : "TODO"}_${slug}_${(hash >>> 0).toString(16)}`;
}

function sheetFor(email, type) {
  if (!["notes", "todos"].includes(type)) throw new Error("Jenis data tidak valid.");
  return accountSheetName(email, type);
}

function quoteSheet(name) {
  return `'${name.replace(/'/g, "''")}'`;
}

async function ensureSheet(email, type) {
  const sheets = getSheetsClient();
  const spreadsheetId = type.spreadsheetId;
  const tabType = type.type;
  const name = sheetFor(email, tabType);
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = (meta.data.sheets || []).find((sheet) => sheet.properties.title === name);
  if (existing) {
    const header = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${quoteSheet(name)}!A1:F1`,
    });
    const values = header.data.values?.[0] || [];
    if (values.length && HEADER.some((value, index) => values[index] !== value)) {
      throw new Error(`Tab ${name} sudah ada tetapi format kolomnya tidak sesuai.`);
    }
    if (!values.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${quoteSheet(name)}!A1:F1`,
        valueInputOption: "RAW",
        requestBody: { values: [HEADER] },
      });
    }
    return { sheets, spreadsheetId, name };
  }

  const created = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        addSheet: {
          properties: {
            title: name,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      }],
    },
  });
  const newSheet = created.data.replies?.[0]?.addSheet;
  if (!newSheet) throw new Error(`Tab ${name} tidak berhasil dibuat.`);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteSheet(name)}!A1:F1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADER] },
  });
  return { sheets, spreadsheetId, name };
}

function parsePayload(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Data Catatan/To Do di spreadsheet tidak valid.");
  }
}

function cleanFields(fields) {
  if (!Array.isArray(fields) || fields.length > 20) {
    throw new Error("Form harus memiliki maksimal 20 field.");
  }
  const seenIds = new Set();
  return fields.map((field) => {
    const id = String(field.id || "").trim();
    const label = String(field.label || "").trim();
    if (!id || !label || !ALLOWED_TYPES.has(field.type) || seenIds.has(id)) {
      throw new Error("Setiap field harus memiliki label, tipe, dan ID yang valid.");
    }
    seenIds.add(id);
    const clean = {
      id,
      label,
      type: field.type,
      required: Boolean(field.required),
    };
    if (field.type === "select") {
      const options = [...new Set((field.options || []).map((option) => String(option).trim()).filter(Boolean))];
      if (!options.length) throw new Error(`Tambahkan minimal satu pilihan untuk field “${label}”.`);
      clean.options = options.slice(0, 30);
    }
    return clean;
  });
}

function getSummary(fields, values) {
  const field = fields.find(
    (candidate) => ["text", "textarea", "select"].includes(candidate.type) && values[candidate.id]
  ) || fields.find((candidate) => candidate.type === "date" && values[candidate.id]);
  return field ? String(values[field.id]).trim() : "";
}

function getDueDate(fields, values) {
  const field = fields.find((candidate) => candidate.type === "date" && values[candidate.id]);
  return field ? String(values[field.id]) : "";
}

export async function loadNotesTodos(email, type, spreadsheetId) {
  const { sheets, name } = await ensureSheet(email, { type, spreadsheetId });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheet(name)}!A2:F`,
  });
  const owner = normalizeEmail(email);
  const rows = response.data.values || [];
  const schemaRow = rows.find(
    (row) => row[0] === "__FORM_SCHEMA__" && String(row[1] || "").trim().toLowerCase() === owner
  );
  const fields = schemaRow ? cleanFields(parsePayload(schemaRow[5], DEFAULT_FIELDS[type])) : DEFAULT_FIELDS[type];
  const items = rows.flatMap((row) => {
    const rowEmail = String(row[1] || "").trim().toLowerCase();
    if (!row[0] || row[0] === "__FORM_SCHEMA__" || rowEmail !== owner) return [];
    const values = parsePayload(row[5], {});
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      throw new Error("Data item Catatan/To Do di spreadsheet tidak valid.");
    }
    return [{
      id: row[0],
      title: getSummary(fields, values),
      dueDate: getDueDate(fields, values),
      values,
      done: Boolean(values.__done),
      status: TODO_STATUSES.includes(values.__status)
        ? values.__status
        : values.__done ? "Selesai" : TODO_STATUSES[0],
      calendarEvent: values.__calendarEvent || null,
      createdAt: row[3] || "",
      updatedAt: row[4] || "",
    }];
  });
  return { fields, items };
}

export async function saveNotesTodosFields(email, type, spreadsheetId, fields) {
  const clean = cleanFields(fields);
  const { sheets, name } = await ensureSheet(email, { type, spreadsheetId });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheet(name)}!A2:B`,
  });
  const rows = response.data.values || [];
  const owner = normalizeEmail(email);
  const index = rows.findIndex(
    (row) => row[0] === "__FORM_SCHEMA__" && String(row[1] || "").trim().toLowerCase() === owner
  );
  const targetRow = index < 0 ? rows.length + 2 : index + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteSheet(name)}!A${targetRow}:F${targetRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        "__FORM_SCHEMA__",
        owner,
        "Form kustom",
        "",
        new Date().toISOString(),
        JSON.stringify(clean),
      ]],
    },
  });
  return clean;
}

export async function saveNotesTodosItem(email, type, spreadsheetId, fields, values, previous) {
  const cleanFieldsList = cleanFields(fields);
  const cleanValues = Object.fromEntries(
    cleanFieldsList.map((field) => [field.id, values[field.id] ?? (field.type === "checkbox" ? false : "")])
  );
  if (type === "todos") {
    const status = TODO_STATUSES.includes(values.__status)
      ? values.__status
      : previous?.status || (previous?.done ? "Selesai" : TODO_STATUSES[0]);
    cleanValues.__status = status;
    cleanValues.__done = status === "Selesai";
  }
  if (previous?.calendarEvent) cleanValues.__calendarEvent = previous.calendarEvent;
  const now = new Date().toISOString();
  const item = {
    id: previous?.id || crypto.randomUUID(),
    title: getSummary(cleanFieldsList, cleanValues),
    dueDate: getDueDate(cleanFieldsList, cleanValues),
    values: cleanValues,
    done: Boolean(cleanValues.__done),
    calendarEvent: cleanValues.__calendarEvent || null,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
  const { sheets, name } = await ensureSheet(email, { type, spreadsheetId });
  if (previous?.id) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${quoteSheet(name)}!A2:B`,
    });
    const owner = normalizeEmail(email);
    const index = (response.data.values || []).findIndex(
      (row) => row[0] === previous.id && String(row[1] || "").trim().toLowerCase() === owner
    );
    if (index < 0) throw new Error("Item ini tidak ditemukan di spreadsheet. Muat ulang data lalu coba lagi.");
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheet(name)}!A${index + 2}:F${index + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [[item.id, normalizeEmail(email), item.title, item.createdAt, now, JSON.stringify(item.values)]] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${quoteSheet(name)}!A:F`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[item.id, normalizeEmail(email), item.title, item.createdAt, now, JSON.stringify(item.values)]],
      },
    });
  }
  return item;
}

export async function deleteNotesTodosItem(email, type, spreadsheetId, itemId) {
  const { sheets, name } = await ensureSheet(email, { type, spreadsheetId });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheet(name)}!A2:B`,
  });
  const index = (response.data.values || []).findIndex(
    (row) => row[0] === itemId && String(row[1] || "").trim().toLowerCase() === normalizeEmail(email)
  );
  if (index < 0) throw new Error("Item ini tidak ditemukan di spreadsheet. Muat ulang data lalu coba lagi.");
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${quoteSheet(name)}!A${index + 2}:F${index + 2}`,
  });
}
