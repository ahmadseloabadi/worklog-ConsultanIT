import { getSheetsClient } from "@/lib/googleClient";

const SPREADSHEET_ID = "1cyQqEs3nS6WfprO9i-4qsPLV9-Fe_ZgyP38NaNWyK0Y";
const SHEET_NAME = "MINI_GAME_HIGHSCORES";
const HEADER = ["Game ID", "Game", "Username", "Google Account", "High Score", "Updated At", "Mode"];
const MODES = ["freeplay", "competitive"];

async function ensureScoreSheet(sheets) {
  const getSheet = async () => {
    const response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    return response.data.sheets?.find((sheet) => sheet.properties.title === SHEET_NAME);
  };

  let sheet = await getSheet();
  if (!sheet) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: SHEET_NAME, gridProperties: { frozenRowCount: 1 } } } }],
        },
      });
    } catch (error) {
      sheet = await getSheet();
      if (!sheet) throw error;
    }
  }

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A1:G1`,
  });
  const currentHeader = headerResponse.data.values?.[0] || [];
  if (!currentHeader.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A1:G1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  } else if (HEADER.slice(0, 6).some((value, index) => currentHeader[index] !== value)) {
    throw new Error(`Format tab ${SHEET_NAME} tidak sesuai. Periksa baris header sebelum menggunakan leaderboard.`);
  } else if (!currentHeader[6]) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!G1`,
      valueInputOption: "RAW",
      requestBody: { values: [[HEADER[6]]] },
    });
  } else if (currentHeader[6] !== HEADER[6]) {
    throw new Error(`Format kolom Mode pada tab ${SHEET_NAME} tidak sesuai.`);
  }
}

async function readScoreRows(sheets) {
  await ensureScoreSheet(sheets);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A2:G`,
  });
  return (response.data.values || []).flatMap((row, index) => {
    const [gameId, game, username, email, rawScore, updatedAt, rawMode] = row;
    const score = Number(rawScore);
    if (!gameId || !email || !Number.isSafeInteger(score) || score < 0) return [];
    const mode = rawMode || "competitive";
    if (!MODES.includes(mode)) return [];
    return [{
      gameId,
      game,
      mode,
      username,
      email: email.toLowerCase(),
      score,
      updatedAt: updatedAt || "",
      rowNumber: index + 2,
    }];
  });
}

function bestScoresByPlayer(rows, gameId, mode) {
  const bestByEmail = new Map();
  rows.filter((row) => row.gameId === gameId && row.mode === mode).forEach((row) => {
    const previous = bestByEmail.get(row.email);
    if (!previous || row.score > previous.score) bestByEmail.set(row.email, row);
  });
  return [...bestByEmail.values()].sort((left, right) =>
    right.score - left.score ||
    left.updatedAt.localeCompare(right.updatedAt) ||
    left.username.localeCompare(right.username, "id")
  );
}

export async function getMiniGameLeaderboards(gameIds) {
  const rows = await readScoreRows(getSheetsClient());
  return Object.fromEntries(gameIds.map((gameId) => [
    gameId,
    Object.fromEntries(MODES.map((mode) => [mode, bestScoresByPlayer(rows, gameId, mode)])),
  ]));
}

export async function getMiniGameLeaderboard(gameId, mode = "competitive") {
  if (!MODES.includes(mode)) throw new Error("Mode leaderboard tidak valid.");
  const leaderboards = await getMiniGameLeaderboards([gameId]);
  return leaderboards[gameId][mode];
}

export async function saveMiniGameHighScore({ gameId, game, email, score, mode = "competitive" }) {
  if (!MODES.includes(mode)) throw new Error("Mode permainan tidak valid.");
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Akun Google tidak valid. Masuk kembali untuk menyimpan high score.");
  }
  if (!Number.isSafeInteger(score) || score < 1) {
    throw new Error("Skor high score tidak valid.");
  }

  const sheets = getSheetsClient();
  const rows = await readScoreRows(sheets);
  const playerRows = rows
    .filter((row) => row.gameId === gameId && row.mode === mode && row.email === normalizedEmail)
    .sort((left, right) => right.score - left.score);
  const bestRow = playerRows[0];
  const previous = bestRow?.score || 0;
  if (score <= previous) return { saved: false, bestScore: previous };

  const username = normalizedEmail.split("@")[0];
  const updatedAt = new Date().toISOString();
  const values = [[gameId, game, username, normalizedEmail, score, updatedAt, mode]];
  if (bestRow) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A${bestRow.rowNumber}:G${bestRow.rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A:G`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
  }
  return {
    saved: true,
    bestScore: score,
    record: { gameId, game, mode, username, email: normalizedEmail, score, updatedAt },
  };
}
