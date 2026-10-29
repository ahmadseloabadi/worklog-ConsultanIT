import { checkTokenStatus } from "@/lib/auth";
import { uploadImage, validateDriveFolder } from "@/lib/googleDrive";
import {
  deleteSavedTemplate,
  deleteWorklog,
  getSavedTemplates,
  getWorklogs,
  insertRowsChronological,
  monthSheetName,
  normalizeSimilarWorklogs,
  saveTemplates,
  updateWorklog,
  validateSpreadsheetAccess,
} from "@/lib/googleSheets";

/**
 * Pengganti folder app/api milik Next.js. Komponen tetap memanggil
 * apiFetch("/api/...") dengan bentuk request/response yang sama seperti dulu,
 * tetapi sekarang diproses langsung di browser lewat Google REST API.
 */

const ID_PATTERN = /^[a-zA-Z0-9_-]{10,}$/;
const TEMPLATE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;
const TEMPLATE_FIELDS = [
  "namaAplikasiDaerah",
  "menu",
  "permasalahan",
  "solusi",
  "keterangan",
];
const isGoogleId = (value) => typeof value === "string" && ID_PATTERN.test(value);
const hasText = (value) => typeof value === "string" && value.trim();

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

/** "DD/MM/YYYY" -> Date (null bila tidak valid) */
function parseDisplayDate(value) {
  const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/** "YYYY-MM-DD" -> "DD/MM/YYYY" (null bila tidak valid) */
function isoToDisplay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

// ---------------- handler per endpoint ----------------

async function getDashboard(url) {
  const spreadsheetId = url.searchParams.get("spreadsheetId");
  if (!isGoogleId(spreadsheetId)) throw fail("Spreadsheet belum diatur.");
  return { worklogs: await getWorklogs(spreadsheetId) };
}

async function postBatch(body) {
  const { entries, spreadsheetId } = body;
  if (!isGoogleId(spreadsheetId)) throw fail("Spreadsheet belum diatur.");
  if (!Array.isArray(entries) || entries.length === 0) throw fail("Pilih minimal satu draft untuk dikirim.");
  if (entries.length > 100) throw fail("Maksimal 100 laporan dapat dikirim sekaligus.");

  entries.forEach((entry, index) => {
    const label = `Laporan nomor ${index + 1}`;
    if (
      !entry ||
      !hasText(entry.namaAplikasiDaerah) ||
      !hasText(entry.menu) ||
      !entry.tglMulai ||
      !hasText(entry.permasalahan) ||
      !hasText(entry.solusi)
    ) {
      throw fail(`${label}: semua kolom wajib diisi kecuali Keterangan.`);
    }
    const startDate = parseDisplayDate(entry.tglMulai);
    if (!startDate) throw fail(`${label}: tanggal mulai tidak valid.`);
    monthSheetName(entry.tglMulai);
    const endDate = entry.tglSelesai ? parseDisplayDate(entry.tglSelesai) : null;
    if ((entry.tglSelesai && !endDate) || (endDate && endDate < startDate)) {
      throw fail(`${label}: tanggal selesai tidak valid atau lebih awal dari tanggal mulai.`);
    }
  });

  const entriesWithEvidenceLinks = entries.map((entry) => {
    const imageUrls = Array.isArray(entry.imageUrls)
      ? entry.imageUrls.filter((url) => typeof url === "string" && url.trim())
      : entry.imageUrl
        ? [entry.imageUrl]
        : [];
    const evidenceLinks = imageUrls.map((url, index) => `Bukti ${index + 1}: ${url}`).join("\n");
    return {
      ...entry,
      keterangan: [entry.keterangan?.trim(), evidenceLinks].filter(Boolean).join("\n"),
    };
  });

  const result = await insertRowsChronological(entriesWithEvidenceLinks, spreadsheetId);
  return {
    ok: true,
    count: entries.length,
    sheets: result.sheets,
    similarValues: result.similarValues,
    similarityWarning: result.similarityWarning,
    borderWarning: result.borderWarning,
  };
}

async function patchLog(id, body) {
  if (!isGoogleId(body.spreadsheetId)) throw fail("Spreadsheet belum diatur.");
  if (!body.expected || typeof body.expected !== "object") throw fail("Data laporan awal tidak valid.");
  if (["namaAplikasiDaerah", "menu", "permasalahan", "solusi"].some((field) => !hasText(body[field]))) {
    throw fail("Nama aplikasi, menu, permasalahan, dan solusi wajib diisi.");
  }
  const tglMulai = isoToDisplay(body.tglMulai);
  const tglSelesai = body.tglSelesai ? isoToDisplay(body.tglSelesai) : "";
  if (!tglMulai || (body.tglSelesai && !tglSelesai) || (tglSelesai && tglSelesai < body.tglMulai)) {
    throw fail("Tanggal mulai/selesai tidak valid atau tanggal selesai lebih awal.");
  }
  if (typeof body.keterangan !== "string") throw fail("Keterangan tidak valid.");

  const rowValues = [
    "",
    body.namaAplikasiDaerah.trim(),
    body.menu.trim(),
    tglMulai,
    body.permasalahan.trim(),
    body.solusi.trim(),
    tglSelesai,
    body.keterangan.trim(),
  ];
  return { ok: true, ...(await updateWorklog(id, rowValues, body.expected, body.spreadsheetId)) };
}

async function deleteLog(id, body) {
  if (!isGoogleId(body.spreadsheetId)) throw fail("Spreadsheet belum diatur.");
  if (!body.expected || typeof body.expected !== "object") throw fail("Data laporan awal tidak valid.");
  return { ok: true, ...(await deleteWorklog(id, body.expected, body.spreadsheetId)) };
}

async function postNormalize(body) {
  if (!isGoogleId(body.spreadsheetId)) throw fail("Spreadsheet belum diatur.");
  const result = await normalizeSimilarWorklogs(
    body.field,
    body.variants,
    body.canonicalValue,
    body.expectedReports,
    body.spreadsheetId
  );
  return { ok: true, ...result };
}

async function postUpload(body) {
  const { dataUrl, fileName, folderId } = body;
  if (!isGoogleId(folderId)) throw fail("Folder Google Drive belum diatur.");
  return { ok: true, url: await uploadImage(dataUrl, fileName, folderId) };
}

async function postValidate(body) {
  const { spreadsheetId, folderId } = body;
  if (!isGoogleId(spreadsheetId)) throw fail("Link spreadsheet tidak valid.");
  if (folderId && !isGoogleId(folderId)) throw fail("Link folder Google Drive tidak valid.");
  const [spreadsheet, folder] = await Promise.all([
    validateSpreadsheetAccess(spreadsheetId),
    folderId ? validateDriveFolder(folderId) : Promise.resolve(null),
  ]);
  return { ok: true, spreadsheet, folder };
}

function validateTemplate(template, index = 0) {
  const label = `Template nomor ${index + 1}`;
  if (
    !template ||
    typeof template !== "object" ||
    typeof template.id !== "string" ||
    !TEMPLATE_ID_PATTERN.test(template.id || "") ||
    !hasText(template.name) ||
    template.name.trim().length > 100 ||
    !template.fields ||
    typeof template.fields !== "object" ||
    Array.isArray(template.fields)
  ) {
    throw fail(`${label}: format template tidak valid.`);
  }
  const fields = {};
  TEMPLATE_FIELDS.forEach((field) => {
    const value = template.fields[field] ?? "";
    if (typeof value !== "string") throw fail(`${label}: isi kolom template tidak valid.`);
    fields[field] = value;
  });
  const now = new Date().toISOString();
  return {
    id: template.id,
    name: template.name.trim(),
    fields,
    createdAt: typeof template.createdAt === "string" ? template.createdAt : now,
    updatedAt: typeof template.updatedAt === "string" ? template.updatedAt : now,
  };
}

async function getTemplates(url) {
  const spreadsheetId = url.searchParams.get("spreadsheetId");
  if (!isGoogleId(spreadsheetId)) throw fail("Spreadsheet belum diatur.");
  return { templates: await getSavedTemplates(spreadsheetId) };
}

async function postTemplates(body) {
  const { spreadsheetId } = body;
  if (!isGoogleId(spreadsheetId)) throw fail("Spreadsheet belum diatur.");
  const source = Array.isArray(body.templates) ? body.templates : [body.template];
  if (!Array.isArray(source) || source.length === 0 || source.length > 500) {
    throw fail("Pilih 1 sampai 500 template untuk disimpan.");
  }
  const templates = source.map(validateTemplate);
  if (new Set(templates.map((template) => template.id)).size !== templates.length) {
    throw fail("Data berisi ID template yang berulang.");
  }
  await saveTemplates(templates, spreadsheetId);
  return { ok: true, count: templates.length };
}

async function deleteTemplate(id, body) {
  if (!TEMPLATE_ID_PATTERN.test(id)) throw fail("ID template tidak valid.");
  if (!isGoogleId(body.spreadsheetId)) throw fail("Spreadsheet belum diatur.");
  await deleteSavedTemplate(id, body.spreadsheetId);
  return { ok: true };
}

// ---------------- router ----------------

async function route(method, url, body) {
  const path = url.pathname;
  const logId = path.match(/^\/api\/log\/([^/]+)$/)?.[1];
  const templateId = path.match(/^\/api\/templates\/([^/]+)$/)?.[1];

  if (method === "GET" && path === "/api/dashboard") return getDashboard(url);
  if (method === "GET" && path === "/api/templates") return getTemplates(url);
  if (method === "POST" && path === "/api/templates") return postTemplates(body);
  if (method === "DELETE" && templateId) return deleteTemplate(decodeURIComponent(templateId), body);
  if (method === "GET" && path === "/api/auth/status") return checkTokenStatus();
  if (method === "POST" && path === "/api/setup/validate") return postValidate(body);
  if (method === "POST" && path === "/api/upload") return postUpload(body);
  if (method === "POST" && path === "/api/log/batch") return postBatch(body);
  if (method === "POST" && path === "/api/log/normalize") return postNormalize(body);
  if (method === "PATCH" && logId) return patchLog(decodeURIComponent(logId), body);
  if (method === "DELETE" && logId) return deleteLog(decodeURIComponent(logId), body);
  throw fail("Endpoint tidak ditemukan.", 404);
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Drop-in pengganti fetch("/api/...") yang mengembalikan objek Response. */
export async function apiFetch(input, init = {}) {
  const url = new URL(input, window.location.origin);
  const method = (init.method || "GET").toUpperCase();
  try {
    const body = init.body ? JSON.parse(init.body) : {};
    const result = await route(method, url, body);
    return jsonResponse(result, 200);
  } catch (error) {
    return jsonResponse(
      { error: error.message || "Terjadi kesalahan." },
      error.status >= 400 && error.status < 600 ? error.status : 500
    );
  }
}
