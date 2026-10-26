import { getAccessToken, invalidateToken } from "@/lib/auth";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_BASE = "https://www.googleapis.com/drive/v3/files";

const FRIENDLY_MESSAGES = {
  403: "Akses ditolak Google. Pastikan akun yang login punya izin Editor ke spreadsheet/folder tersebut.",
  404: "File tidak ditemukan atau tidak dapat diakses oleh akun yang login.",
  429: "Terlalu banyak permintaan ke Google. Tunggu sebentar lalu coba lagi.",
};

async function toError(response) {
  let message = "";
  try {
    const body = await response.json();
    message = body?.error?.message || "";
  } catch {
    // body bukan JSON
  }
  const fallback = FRIENDLY_MESSAGES[response.status] || `Permintaan Google gagal (${response.status}).`;
  const error = new Error(message && response.status !== 404 ? message : fallback);
  error.status = response.status;
  return error;
}

/** fetch ke Google API dengan Bearer token; satu kali ulang bila token ditolak (401). */
export async function googleFetch(url, init = {}, canRetry = true) {
  const token = await getAccessToken();
  let response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
  } catch {
    throw Object.assign(new Error("Tidak dapat terhubung ke Google. Periksa koneksi internet."), {
      status: 503,
    });
  }
  if (response.status === 401 && canRetry) {
    invalidateToken();
    return googleFetch(url, init, false);
  }
  if (!response.ok) throw await toError(response);
  return response;
}

async function googleJson(url, init) {
  const response = await googleFetch(url, init);
  return response.status === 204 ? null : response.json();
}

const jsonBody = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body ?? {}),
});

const enc = encodeURIComponent;

/**
 * Klien Sheets mini dengan bentuk yang sama seperti `googleapis`
 * (sheets.spreadsheets.values.get, dst.) sehingga logika di googleSheets.js
 * dapat dipindahkan hampir tanpa perubahan.
 */
export function getSheetsClient() {
  return {
    spreadsheets: {
      get: async ({ spreadsheetId, fields = "sheets.properties" }) => ({
        data: await googleJson(`${SHEETS_BASE}/${spreadsheetId}?fields=${enc(fields)}`),
      }),
      batchUpdate: async ({ spreadsheetId, requestBody }) => ({
        data: await googleJson(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, jsonBody("POST", requestBody)),
      }),
      values: {
        get: async ({ spreadsheetId, range }) => ({
          data: await googleJson(`${SHEETS_BASE}/${spreadsheetId}/values/${enc(range)}`),
        }),
        update: async ({ spreadsheetId, range, valueInputOption, requestBody }) => ({
          data: await googleJson(
            `${SHEETS_BASE}/${spreadsheetId}/values/${enc(range)}?valueInputOption=${valueInputOption}`,
            jsonBody("PUT", requestBody)
          ),
        }),
        batchGet: async ({ spreadsheetId, ranges }) => ({
          data: await googleJson(
            `${SHEETS_BASE}/${spreadsheetId}/values:batchGet?${ranges.map((range) => `ranges=${enc(range)}`).join("&")}`
          ),
        }),
        batchUpdate: async ({ spreadsheetId, valueInputOption, requestBody }) => ({
          data: await googleJson(
            `${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`,
            jsonBody("POST", { valueInputOption, ...requestBody })
          ),
        }),
        clear: async ({ spreadsheetId, range }) => ({
          data: await googleJson(`${SHEETS_BASE}/${spreadsheetId}/values/${enc(range)}:clear`, jsonBody("POST", {})),
        }),
        batchClear: async ({ spreadsheetId, requestBody }) => ({
          data: await googleJson(`${SHEETS_BASE}/${spreadsheetId}/values:batchClear`, jsonBody("POST", requestBody)),
        }),
      },
    },
  };
}

export function driveGetFile(fileId, fields) {
  return googleJson(`${DRIVE_BASE}/${fileId}?supportsAllDrives=true&fields=${enc(fields)}`);
}

export async function driveCreatePermission(fileId, requestBody) {
  return googleJson(`${DRIVE_BASE}/${fileId}/permissions?supportsAllDrives=true`, jsonBody("POST", requestBody));
}

export function driveDownload(fileId) {
  return googleFetch(`${DRIVE_BASE}/${fileId}?alt=media&supportsAllDrives=true`);
}

export function driveUploadMultipart(metadata, blob, mimeType) {
  const boundary = `worklog${Math.random().toString(36).slice(2)}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ]);
  return googleJson(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );
}
