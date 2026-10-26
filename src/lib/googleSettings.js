const SETTINGS_PREFIX = "daily-worklog-google-settings";

export function extractGoogleResourceId(value, resourceType) {
  const input = String(value || "").trim();
  if (!input) throw new Error("Link Google wajib diisi.");

  let id = input;
  if (/^https?:\/\//i.test(input)) {
    let url;
    try {
      url = new URL(input);
    } catch {
      throw new Error("Link Google tidak valid.");
    }

    if (!["drive.google.com", "docs.google.com"].includes(url.hostname)) {
      throw new Error("Gunakan link dari drive.google.com atau docs.google.com.");
    }
    const pathPattern = resourceType === "spreadsheet"
      ? /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/
      : /\/folders\/([a-zA-Z0-9_-]+)/;
    id = url.pathname.match(pathPattern)?.[1] || url.searchParams.get("id") || "";
  }

  if (!/^[a-zA-Z0-9_-]{10,}$/.test(id)) {
    throw new Error(
      resourceType === "spreadsheet"
        ? "Link spreadsheet tidak dikenali. Salin URL Google Sheets."
        : "Link folder Drive tidak dikenali. Salin link folder, bukan link file gambar."
    );
  }
  return id;
}

function storageKey(email) {
  return `${SETTINGS_PREFIX}:${String(email || "").trim().toLowerCase()}`;
}

export function readGoogleSettings(email) {
  if (!email || typeof localStorage === "undefined") return null;
  try {
    const saved = localStorage.getItem(storageKey(email));
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error("Gagal membaca pengaturan Google lokal.", error);
    return null;
  }
}

export function saveGoogleSettings(email, settings) {
  if (!email || typeof localStorage === "undefined") {
    throw new Error("Pengaturan hanya dapat disimpan setelah login.");
  }
  localStorage.setItem(storageKey(email), JSON.stringify(settings));
}
