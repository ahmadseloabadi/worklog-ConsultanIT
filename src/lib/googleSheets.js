import { driveGetFile, getSheetsClient } from "@/lib/googleClient";
import { findSimilarValueGroups } from "@/lib/similarValues";

// 8 kolom baku - urutan TIDAK BOLEH diubah
export const HEADER = [
  "No",
  "Nama Aplikasi & Daerah",
  "Menu",
  "Tgl Mulai",
  "Permasalahan yang Dihadapi",
  "Solusi",
  "Tgl Selesai",
  "Keterangan",
];

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const MONTH_INDEX_BY_NAME = new Map(
  MONTH_NAMES_ID.map((name, index) => [name.toLowerCase(), index])
);
const TEMPLATE_SHEET_NAME = "TEMPLATE_APLIKASI";
const TEMPLATE_HEADER = ["ID", "Nama template", "Data template", "Dibuat", "Diperbarui"];

export async function validateSpreadsheetAccess(spreadsheetId) {
  const file = await driveGetFile(spreadsheetId, "id,name,mimeType,capabilities(canEdit)");
  if (file.mimeType !== "application/vnd.google-apps.spreadsheet") {
    throw new Error("Link pertama harus menuju file Google Sheets.");
  }
  if (!file.capabilities?.canEdit) {
    throw new Error("Akun Google yang login harus memiliki akses Editor ke spreadsheet.");
  }

  await getSheetsClient().spreadsheets.get({ spreadsheetId, fields: "spreadsheetId" });
  return { id: file.id, name: file.name };
}

async function getTemplateSheet(spreadsheetId, create = false) {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets.find(
    (sheet) => sheet.properties.title === TEMPLATE_SHEET_NAME
  );
  if (existing) return { sheets, sheet: existing.properties };
  if (!create) return { sheets, sheet: null };

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        addSheet: {
          properties: {
            title: TEMPLATE_SHEET_NAME,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      }],
    },
  });
  const sheet = response.data.replies[0].addSheet.properties;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${TEMPLATE_SHEET_NAME}'!A1:E1`,
    valueInputOption: "RAW",
    requestBody: { values: [TEMPLATE_HEADER] },
  });
  return { sheets, sheet };
}

export async function getSavedTemplates(spreadsheetId) {
  const { sheets, sheet } = await getTemplateSheet(spreadsheetId);
  if (!sheet) return [];
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${TEMPLATE_SHEET_NAME}'!A2:E`,
  });
  return (response.data.values || []).flatMap((row) => {
    if (!row[0]) return [];
    let fields;
    try {
      fields = JSON.parse(row[2] || "{}");
    } catch {
      throw new Error(`Data template “${row[1] || row[0]}” tidak valid di spreadsheet.`);
    }
    return [{
      id: row[0],
      name: row[1] || "",
      fields,
      createdAt: row[3] || "",
      updatedAt: row[4] || "",
    }];
  });
}

export async function saveTemplates(templates, spreadsheetId) {
  if (!templates.length) return;
  const { sheets } = await getTemplateSheet(spreadsheetId, true);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${TEMPLATE_SHEET_NAME}'!A2:A`,
  });
  const rows = response.data.values || [];
  const rowById = new Map(rows.map((row, index) => [row[0], index + 2]));
  let nextRow = rows.length + 2;
  const data = templates.map((template) => {
    const row = rowById.get(template.id) || nextRow++;
    return {
      range: `'${TEMPLATE_SHEET_NAME}'!A${row}:E${row}`,
      values: [[
        template.id,
        template.name,
        JSON.stringify(template.fields),
        template.createdAt,
        template.updatedAt,
      ]],
    };
  });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    valueInputOption: "RAW",
    requestBody: { data },
  });
}

export async function deleteSavedTemplate(id, spreadsheetId) {
  const { sheets, sheet } = await getTemplateSheet(spreadsheetId);
  if (!sheet) return;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${TEMPLATE_SHEET_NAME}'!A2:A`,
  });
  const rowIndex = (response.data.values || []).findIndex((row) => row[0] === id);
  if (rowIndex < 0) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.sheetId,
            dimension: "ROWS",
            startIndex: rowIndex + 1,
            endIndex: rowIndex + 2,
          },
        },
      }],
    },
  });
}

/** Nama sheet bulan dari sebuah tanggal, mis. "Februari_2026" */
export function monthSheetName(date) {
  const d = parseRowDate(date);
  if (!d) throw new Error("Tanggal mulai tidak valid.");
  return `${MONTH_NAMES_ID[d.getMonth()]}_${d.getFullYear()}`;
}

/**
 * Pastikan sheet bulan (tab) untuk tanggal tsb ada. Jika belum ada,
 * buat sheet baru + tulis header 8 kolom baku di baris 1.
 * Mengembalikan { sheetId, sheetName }
 */
export async function getOrCreateMonthlySheet(dateStr, spreadsheetId) {
  const sheets = getSheetsClient();
  const sheetName = monthSheetName(dateStr);
  const legacySheetName = sheetName.replace("_", " ");

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets.find(
    (s) => s.properties.title === sheetName || s.properties.title === legacySheetName
  );

  if (existing) {
    return { sheetId: existing.properties.sheetId, sheetName: existing.properties.title };
  }

  const template = meta.data.sheets.find((s) => s.properties.title === "CONTOH");
  let newSheetId;

  if (template) {
    const duplicateResp = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            duplicateSheet: {
              sourceSheetId: template.properties.sheetId,
              insertSheetIndex: meta.data.sheets.length,
              newSheetName: sheetName,
            },
          },
        ],
      },
    });
    newSheetId = duplicateResp.data.replies[0].duplicateSheet.properties.sheetId;

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${sheetName}'!A2:Z`,
    });
  } else {
    const addResp = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
                index: meta.data.sheets.length,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          },
        ],
      },
    });
    newSheetId = addResp.data.replies[0].addSheet.properties.sheetId;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!A1:H1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat.bold",
            },
          },
        ],
      },
    });
  }

  return { sheetId: newSheetId, sheetName };
}

/** Parse "DD/MM/YYYY" atau ISO string jadi Date yang bisa dibandingkan */
function parseRowDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T)/);
  if (dmy || iso) {
    const [, first, second, third] = dmy || iso;
    const year = Number(dmy ? third : first);
    const month = Number(second);
    const day = Number(dmy ? first : third);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) return null;
    return date;
  }
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateForInput(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Ambil laporan dari semua tab bulanan yang dikenal, tanpa menyertakan tab template. */
export async function getWorklogs(spreadsheetId) {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return readWorklogs(sheets, spreadsheetId, meta);
}

async function readWorklogs(sheets, spreadsheetId, meta) {
  const monthlySheets = (meta.data.sheets || []).filter((sheet) => {
    const match = sheet.properties.title.match(/^([A-Za-z]+)[_ ](\d{4})$/);
    return match && MONTH_INDEX_BY_NAME.has(match[1].toLowerCase());
  });

  if (!monthlySheets.length) return [];

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: monthlySheets.map(({ properties }) =>
      `'${properties.title.replace(/'/g, "''")}'!A2:H`
    ),
  });

  return monthlySheets.flatMap((sheet, sheetIndex) => {
    const rows = response.data.valueRanges?.[sheetIndex]?.values || [];
    return rows.flatMap((row, rowIndex) => {
      if (!row.some((value) => String(value || "").trim())) return [];
      const startDate = parseRowDate(row[3]);
      const endDate = parseRowDate(row[6]);
      return [{
        id: `${sheet.properties.sheetId}-${rowIndex}`,
        sheetName: sheet.properties.title,
        aplikasi: row[1] || "",
        menu: row[2] || "",
        tglMulai: formatDateForInput(startDate),
        permasalahan: row[4] || "",
        solusi: row[5] || "",
        tglSelesai: formatDateForInput(endDate),
        keterangan: row[7] || "",
      }];
    });
  });
}

async function applyDataBorders(spreadsheetId) {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const reports = await readWorklogs(sheets, spreadsheetId, meta);
  const reportsBySheet = new Map();
  for (const report of reports) {
    const separator = report.id.lastIndexOf("-");
    const sheetId = Number(report.id.slice(0, separator));
    const rowIndex = Number(report.id.slice(separator + 1));
    if (!reportsBySheet.has(sheetId)) reportsBySheet.set(sheetId, []);
    reportsBySheet.get(sheetId).push(rowIndex + 1);
  }
  const dataBorder = {
    style: "SOLID",
    color: { red: 0, green: 0, blue: 0 },
  };
  const requests = [];

  for (const sheet of meta.data.sheets || []) {
    const { sheetId, title, gridProperties } = sheet.properties;
    const match = title.match(/^([A-Za-z]+)[_ ](\d{4})$/);
    if (!match || !MONTH_INDEX_BY_NAME.has(match[1].toLowerCase())) continue;

    const rowCount = gridProperties?.rowCount || 1000;
    const dataRows = [...new Set(reportsBySheet.get(sheetId) || [])]
      .filter((rowIndex) => rowIndex > 0 && rowIndex < rowCount)
      .sort((left, right) => left - right);
    const dataRuns = [];
    for (const rowIndex of dataRows) {
      const previousRun = dataRuns[dataRuns.length - 1];
      if (previousRun && rowIndex === previousRun.endRowIndex) {
        previousRun.endRowIndex += 1;
      } else {
        dataRuns.push({ startRowIndex: rowIndex, endRowIndex: rowIndex + 1 });
      }
    }

    const addClearRequest = (startRowIndex, endRowIndex) => {
      if (startRowIndex >= endRowIndex) return;
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex,
            endRowIndex,
            startColumnIndex: 0,
            endColumnIndex: HEADER.length,
          },
          cell: { userEnteredFormat: { borders: {} } },
          fields: "userEnteredFormat.borders",
        },
      });
    };

    const addDataBorderRequest = (startRowIndex, endRowIndex) => requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex,
          endRowIndex,
          startColumnIndex: 0,
          endColumnIndex: HEADER.length,
        },
        cell: {
          userEnteredFormat: {
            borders: {
              top: dataBorder,
              bottom: dataBorder,
              left: dataBorder,
              right: dataBorder,
            },
          },
        },
        fields: "userEnteredFormat.borders",
      },
    });

    let blankStart = 1;
    for (const run of dataRuns) {
      addClearRequest(blankStart, run.startRowIndex);
      addDataBorderRequest(run.startRowIndex, run.endRowIndex);
      blankStart = run.endRowIndex;
    }
    addClearRequest(blankStart, rowCount);
  }

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }
}

async function updateDataBorders(spreadsheetId) {
  try {
    await applyDataBorders(spreadsheetId);
  } catch (error) {
    return {
      borderWarning: `Laporan tersimpan, tetapi border tabel gagal diterapkan: ${error.message}`,
    };
  }
}

function parseWorklogId(id) {
  const match = typeof id === "string" && id.match(/^(\d+)-(\d+)$/);
  if (!match) {
    throw Object.assign(new Error("Identitas laporan tidak valid."), { status: 400 });
  }
  return { sheetId: Number(match[1]), rowIndex: Number(match[2]) };
}

function rowHasValues(row) {
  return row.some((value) => String(value || "").trim());
}

function normalizedRows(rows) {
  return rows.map((row) => Array.from({ length: HEADER.length }, (_, index) => row[index] ?? ""));
}

function numberedRows(rows) {
  return rows.map((row, index) => {
    const values = [...row];
    values[0] = index + 1;
    return values;
  });
}

function sortRowsByStartDate(rows) {
  return rows
    .map((row, index) => ({ row, index, date: parseRowDate(row[3]) }))
    .sort((left, right) => {
      if (left.date && right.date) return left.date - right.date || left.index - right.index;
      if (left.date) return -1;
      if (right.date) return 1;
      return left.index - right.index;
    })
    .map(({ row }) => row);
}

function rowMatchesReport(row, report) {
  const textMatches = [
    [row[1], report.aplikasi],
    [row[2], report.menu],
    [row[4], report.permasalahan],
    [row[5], report.solusi],
    [row[7], report.keterangan],
  ].every(([actual, expected]) => String(actual ?? "") === String(expected ?? ""));
  const dateMatches = [[row[3], report.tglMulai], [row[6], report.tglSelesai]]
    .every(([actual, expected]) => {
      const actualDate = parseRowDate(actual);
      const expectedDate = parseRowDate(expected);
      return actualDate?.getTime() === expectedDate?.getTime() ||
        (!actualDate && !expectedDate);
    });
  return textMatches && dateMatches;
}

async function getWorklogLocation(id, spreadsheetId) {
  const { sheetId, rowIndex } = parseWorklogId(id);
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((item) => item.properties.sheetId === sheetId);
  if (!sheet || !MONTH_INDEX_BY_NAME.has(
    sheet.properties.title.match(/^([A-Za-z]+)[_ ]\d{4}$/)?.[1]?.toLowerCase()
  )) {
    throw Object.assign(new Error("Tab laporan tidak ditemukan."), { status: 404 });
  }
  return { sheets, sheetId, sheetName: sheet.properties.title, rowIndex };
}

export async function updateWorklog(id, rowValues, expectedReport, spreadsheetId) {
  const { sheets, sheetId, sheetName, rowIndex } = await getWorklogLocation(
    id,
    spreadsheetId);
  const sourceResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName.replace(/'/g, "''")}'!A2:H`,
  });
  const sourceRows = sourceResponse.data.values || [];
  const originalRow = sourceRows[rowIndex];
  if (!originalRow || !rowHasValues(originalRow)) {
    throw Object.assign(
      new Error("Laporan tidak ditemukan. Muat ulang daftar lalu coba kembali."),
      { status: 404 }
    );
  }
  if (!rowMatchesReport(originalRow, expectedReport)) {
    throw Object.assign(
      new Error("Laporan berubah sejak dimuat. Muat ulang daftar sebelum menyimpan."),
      { status: 409 }
    );
  }

  const { sheetId: targetSheetId, sheetName: targetSheetName } = await getOrCreateMonthlySheet(
    rowValues[3],
    spreadsheetId);

  if (targetSheetId === sheetId) {
    const updatedRows = normalizedRows(sourceRows)
      .map((row, index) => (index === rowIndex ? rowValues : row))
      .filter(rowHasValues);
    const orderedRows = numberedRows(sortRowsByStartDate(updatedRows));
    while (orderedRows.length < sourceRows.length) {
      orderedRows.push(Array.from({ length: HEADER.length }, () => ""));
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName.replace(/'/g, "''")}'!A2:H${sourceRows.length + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: orderedRows },
    });
    return {
      sheetName,
      ...await updateDataBorders(spreadsheetId),
    };
  }

  const targetResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${targetSheetName.replace(/'/g, "''")}'!A2:H`,
  });
  const existingTargetRows = targetResponse.data.values || [];
  const targetRows = existingTargetRows
    .filter(rowHasValues)
    .map((row) => Array.from({ length: HEADER.length }, (_, index) => row[index] ?? ""));
  const orderedTargetRows = numberedRows(sortRowsByStartDate([...targetRows, rowValues]));
  while (orderedTargetRows.length < existingTargetRows.length + 1) {
    orderedTargetRows.push(Array.from({ length: HEADER.length }, () => ""));
  }
  const remainingSourceRows = numberedRows(
    normalizedRows(sourceRows).filter((row, index) => index !== rowIndex && rowHasValues(row))
  );
  const clearedSourceRows = [
    ...remainingSourceRows,
  ];
  while (clearedSourceRows.length < sourceRows.length) {
    clearedSourceRows.push(Array.from({ length: HEADER.length }, () => ""));
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      data: [
        {
          range: `'${targetSheetName.replace(/'/g, "''")}'!A2:H${orderedTargetRows.length + 1}`,
          values: orderedTargetRows,
        },
        {
          range: `'${sheetName.replace(/'/g, "''")}'!A2:H${sourceRows.length + 1}`,
          values: clearedSourceRows,
        },
      ],
    },
  });
  return {
    sheetName: targetSheetName,
    ...await updateDataBorders(spreadsheetId),
  };
}

export async function normalizeSimilarWorklogs(
  field,
  variants,
  canonicalValue,
  expectedReports,
  spreadsheetId) {
  if (!["aplikasi", "menu"].includes(field)) {
    throw Object.assign(new Error("Kolom yang dipilih tidak valid."), { status: 400 });
  }
  if (
    !Array.isArray(variants) ||
    variants.length < 2 ||
    new Set(variants).size !== variants.length ||
    variants.some((value) => typeof value !== "string" || !value.trim()) ||
    !variants.includes(canonicalValue) ||
    !Array.isArray(expectedReports)
  ) {
    throw Object.assign(new Error("Data penyamaan nilai tidak valid."), { status: 400 });
  }

  const reports = await getWorklogs(spreadsheetId);
  const similarGroup = findSimilarValueGroups(reports, field).find((group) =>
    variants.every((variant) => group.includes(variant))
  );
  if (
    !similarGroup ||
    variants.some((variant) => !similarGroup.includes(variant))
  ) {
    throw Object.assign(
      new Error("Data serupa berubah sejak dimuat. Muat ulang daftar sebelum menyamakan format."),
      { status: 409 }
    );
  }

  const groupReports = reports.filter((report) => variants.includes(report[field]));
  const expectedById = new Map(expectedReports.map((report) => [report.id, report]));
  if (
    expectedById.size !== groupReports.length ||
    groupReports.some((report) => {
      const expected = expectedById.get(report.id);
      return !expected || !rowMatchesReport(
        [
          "",
          report.aplikasi,
          report.menu,
          report.tglMulai,
          report.permasalahan,
          report.solusi,
          report.tglSelesai,
          report.keterangan,
        ],
        expected
      );
    })
  ) {
    throw Object.assign(
      new Error("Data laporan berubah sejak dimuat. Muat ulang daftar sebelum menyamakan format."),
      { status: 409 }
    );
  }

  const column = field === "aplikasi" ? "B" : "C";
  const writeData = groupReports
    .filter((report) => report[field] !== canonicalValue)
    .map((report) => {
      const separator = report.id.lastIndexOf("-");
      const rowIndex = Number(report.id.slice(separator + 1));
      return {
        range: `'${report.sheetName.replace(/'/g, "''")}'!${column}${rowIndex + 2}`,
        values: [[canonicalValue]],
      };
    });

  if (writeData.length) {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      valueInputOption: "RAW",
      requestBody: { data: writeData },
    });
  }

  return {
    updatedCount: writeData.length,
    ...await updateDataBorders(spreadsheetId),
  };
}

export async function deleteWorklog(id, expectedReport, spreadsheetId) {
  const { sheets, sheetId, sheetName, rowIndex } = await getWorklogLocation(
    id,
    spreadsheetId);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName.replace(/'/g, "''")}'!A2:H`,
  });
  const rows = response.data.values || [];
  if (!rows[rowIndex] || !rowHasValues(rows[rowIndex])) {
    throw Object.assign(
      new Error("Laporan tidak ditemukan. Muat ulang daftar lalu coba kembali."),
      { status: 404 }
    );
  }
  if (!rowMatchesReport(rows[rowIndex], expectedReport)) {
    throw Object.assign(
      new Error("Laporan berubah sejak dimuat. Muat ulang daftar sebelum menghapus."),
      { status: 409 }
    );
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: rowIndex + 1,
            endIndex: rowIndex + 2,
          },
        },
      }],
    },
  });
  if (rows.length > 1) {
    await renumberColumn(sheets, sheetName, rows.length - 1, spreadsheetId);
  }
  return updateDataBorders(spreadsheetId);
}

export async function insertRowsChronological(entries, spreadsheetId) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("Tidak ada laporan untuk dikirim.");
  }

  const groups = new Map();
  entries.forEach((entry, index) => {
    const sheetName = monthSheetName(entry.tglMulai);
    const legacySheetName = sheetName.replace("_", " ");
    const rowValues = [
      "",
      entry.namaAplikasiDaerah,
      entry.menu,
      entry.tglMulai,
      entry.permasalahan || "",
      entry.solusi || "",
      entry.tglSelesai || "",
      entry.keterangan || "",
    ];
    if (!groups.has(sheetName)) {
      groups.set(sheetName, { sheetName, legacySheetName, entries: [] });
    }
    groups.get(sheetName).entries.push({ rowValues, order: index });
  });

  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingByTitle = new Map(
    meta.data.sheets.map((sheet) => [sheet.properties.title, sheet.properties])
  );
  const missingGroups = [...groups.values()]
    .filter(
      (group) => !existingByTitle.has(group.sheetName) && !existingByTitle.has(group.legacySheetName)
    )
    .sort((left, right) => {
      const leftDate = parseRowDate(left.entries[0].rowValues[3]);
      const rightDate = parseRowDate(right.entries[0].rowValues[3]);
      return (leftDate?.getTime() || 0) - (rightDate?.getTime() || 0);
    });
  const template = meta.data.sheets.find((sheet) => sheet.properties.title === "CONTOH");
  let headersToWrite = [];

  if (missingGroups.length > 0 && template) {
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missingGroups.map((group, index) => ({
          duplicateSheet: {
            sourceSheetId: template.properties.sheetId,
            insertSheetIndex: meta.data.sheets.length + index,
            newSheetName: group.sheetName,
          },
        })),
      },
    });
    response.data.replies.forEach((reply, index) => {
      const group = missingGroups[index];
      existingByTitle.set(group.sheetName, reply.duplicateSheet.properties);
    });
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: {
        ranges: missingGroups.map((group) => `'${group.sheetName}'!A2:Z`),
      },
    });
  } else if (missingGroups.length > 0) {
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missingGroups.map((group, index) => ({
          addSheet: {
            properties: {
              title: group.sheetName,
              index: meta.data.sheets.length + index,
              gridProperties: { frozenRowCount: 1 },
            },
          },
        })),
      },
    });
    response.data.replies.forEach((reply, index) => {
      const group = missingGroups[index];
      existingByTitle.set(group.sheetName, reply.addSheet.properties);
      headersToWrite.push({ range: `'${group.sheetName}'!A1:H1`, values: [HEADER] });
    });
  }

  const groupList = [...groups.values()];
  groupList.forEach((group) => {
    group.targetName = existingByTitle.has(group.sheetName)
      ? group.sheetName
      : group.legacySheetName;
  });

  const readResponse = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: groupList.map((group) => `'${group.targetName}'!A2:H`),
  });
  const writeData = [...headersToWrite];
  const results = [];
  groupList.forEach((group, groupIndex) => {
    const existingRows = readResponse.data.valueRanges[groupIndex].values || [];
    const mergedRows = existingRows
      .filter((row) => row.some((value) => String(value).trim()))
      .map((row, index) => ({
        rowValues: Array.from({ length: HEADER.length }, (_, column) => row[column] ?? ""),
        date: parseRowDate(row[3]),
        order: index,
      }))
      .concat(group.entries.map((entry) => ({
        ...entry,
        date: parseRowDate(entry.rowValues[3]),
      })));

    mergedRows.sort((left, right) => {
      if (left.date && right.date) return left.date - right.date || left.order - right.order;
      if (left.date) return -1;
      if (right.date) return 1;
      return left.order - right.order;
    });

    const sheetId = existingByTitle.get(group.targetName).sheetId;
    const numberedRows = mergedRows.map(({ rowValues }, index) => {
      const values = [...rowValues];
      values[0] = index + 1;
      return values;
    });

    writeData.push({
      range: `'${group.targetName}'!A2:H${numberedRows.length + 1}`,
      values: numberedRows,
    });
    results.push({ sheetName: group.targetName, count: group.entries.length });
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    valueInputOption: "USER_ENTERED",
    requestBody: { data: writeData },
  });

  return {
    sheets: results,
    ...await updateDataBorders(spreadsheetId),
  };
}

/** Tulis ulang kolom A (No) = 1..totalRows secara berurutan */
async function renumberColumn(sheets, sheetName, totalRows, spreadsheetId) {
  const numbers = Array.from({ length: totalRows }, (_, i) => [i + 1]);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A2:A${totalRows + 1}`,
    valueInputOption: "RAW",
    requestBody: { values: numbers },
  });
}
