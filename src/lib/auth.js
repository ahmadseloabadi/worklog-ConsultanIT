import { useMemo, useSyncExternalStore } from "react";

/**
 * Autentikasi Google sepenuhnya di browser (Google Identity Services, "token model").
 * Tidak ada server dan tidak ada client secret. Access token berlaku ±1 jam dan
 * diperbarui diam-diam bila memungkinkan; antarmuka useSession/signIn/signOut
 * sengaja dibuat mirip next-auth agar komponen lama hampir tidak berubah.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const ALLOWED_DOMAIN = String(import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || "")
  .trim()
  .replace(/^@/, "")
  .toLowerCase();

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const SCOPES = ["openid", "email", "profile", SHEETS_SCOPE, DRIVE_SCOPE].join(" ");

const USER_KEY = "daily-worklog-auth-user";
const TOKEN_KEY = "daily-worklog-auth-token";
const SESSION_EXPIRED_MESSAGE =
  "Sesi Google berakhir. Klik “Sambungkan ulang” di pojok kanan atas, lalu muat ulang data.";

function readJson(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  try {
    if (value) storage.setItem(key, JSON.stringify(value));
    else storage.removeItem(key);
  } catch {
    // Penyimpanan browser tidak tersedia; sesi tetap berjalan di memori.
  }
}

function authError(message, status = 401, code) {
  return Object.assign(new Error(message), { status, code });
}

// ---------- token (memori + sessionStorage agar bertahan saat reload) ----------
let tokenState = readJson(sessionStorage, TOKEN_KEY);
if (tokenState && tokenState.expiresAt <= Date.now()) tokenState = null;

export function hasValidToken() {
  return Boolean(tokenState) && tokenState.expiresAt - Date.now() > 60_000;
}

export function invalidateToken() {
  tokenState = null;
  writeJson(sessionStorage, TOKEN_KEY, null);
}

function storeToken(response) {
  tokenState = {
    token: response.access_token,
    expiresAt: Date.now() + Number(response.expires_in || 3600) * 1000,
  };
  writeJson(sessionStorage, TOKEN_KEY, tokenState);
  setState({ tokenExpired: false });
}

// ---------- store kecil ala next-auth ----------
let state = {
  user: readJson(localStorage, USER_KEY),
  tokenExpired: false,
  error: "",
};
state.tokenExpired = Boolean(state.user) && !hasValidToken();

const listeners = new Set();
function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const getSnapshot = () => state;

export function useSession() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const data = useMemo(
    () => (snapshot.user ? { user: snapshot.user } : null),
    [snapshot.user]
  );
  return {
    data,
    status: snapshot.user ? "authenticated" : "unauthenticated",
    tokenExpired: snapshot.tokenExpired,
    error: snapshot.error,
  };
}

// ---------- Google Identity Services ----------
let gisPromise = null;
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gisPromise = null;
        script.remove();
        reject(authError("Gagal memuat layanan login Google. Periksa koneksi internet.", 503));
      };
      document.head.appendChild(script);
    });
  }
  return gisPromise;
}

export function initAuth() {
  if (!CLIENT_ID) {
    setState({
      error: "VITE_GOOGLE_CLIENT_ID belum diatur. Salin .env.example menjadi .env lalu isi Client ID.",
    });
    return;
  }
  loadGis().catch(() => {});
}

function requestToken({ prompt, hint }) {
  if (!CLIENT_ID) {
    return Promise.reject(authError("VITE_GOOGLE_CLIENT_ID belum diatur.", 500, "config"));
  }
  return loadGis().then(
    () =>
      new Promise((resolve, reject) => {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          prompt,
          hint: hint || undefined,
          callback: (response) => {
            if (response.error) {
              reject(authError(response.error_description || response.error, 401, response.error));
            } else {
              resolve(response);
            }
          },
          error_callback: (error) => {
            reject(authError(error?.message || "Login Google dibatalkan.", 401, error?.type));
          },
        });
        client.requestAccessToken();
      })
  );
}

function ensureScopes(response) {
  const oauth2 = window.google.accounts.oauth2;
  if (oauth2.hasGrantedAllScopes && !oauth2.hasGrantedAllScopes(response, SHEETS_SCOPE, DRIVE_SCOPE)) {
    throw authError(
      "Izin Google Sheets dan Drive belum disetujui lengkap. Masuk kembali dan centang semua izin.",
      403,
      "scope"
    );
  }
}

async function fetchProfile(accessToken) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw authError("Profil akun Google tidak dapat dibaca.", response.status);
  return response.json();
}

// ---------- API publik ----------
let refreshing = null;

/** Mengembalikan access token yang valid; memperbarui diam-diam bila sudah kedaluwarsa. */
export function getAccessToken() {
  if (hasValidToken()) return Promise.resolve(tokenState.token);
  const user = state.user;
  if (!user) return Promise.reject(authError("Belum masuk. Masuk dengan akun Google terlebih dahulu."));

  // Popup Google hanya boleh dibuka setelah interaksi pengguna (klik/ketik).
  const activation = navigator.userActivation;
  if (!refreshing && activation && !activation.isActive) {
    setState({ tokenExpired: true });
    return Promise.reject(authError(SESSION_EXPIRED_MESSAGE, 401, "needs_gesture"));
  }

  if (!refreshing) {
    refreshing = requestToken({ prompt: "none", hint: user.email })
      .then((response) => {
        ensureScopes(response);
        storeToken(response);
        return response.access_token;
      })
      .catch((error) => {
        setState({ tokenExpired: true });
        throw authError(SESSION_EXPIRED_MESSAGE, 401, error.code);
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function signIn() {
  setState({ error: "" });
  try {
    const response = await requestToken({ prompt: "", hint: state.user?.email });
    ensureScopes(response);
    const profile = await fetchProfile(response.access_token);
    const email = String(profile.email || "").toLowerCase();
    if (ALLOWED_DOMAIN && !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      throw authError(`Hanya akun @${ALLOWED_DOMAIN} yang diizinkan masuk.`, 403, "domain");
    }
    storeToken(response);
    const user = {
      id: profile.sub,
      name: profile.name || profile.email,
      email: profile.email,
      image: profile.picture || "",
    };
    writeJson(localStorage, USER_KEY, user);
    setState({ user, tokenExpired: false, error: "" });
  } catch (error) {
    const dismissed = ["popup_closed", "access_denied"].includes(error.code);
    setState({ error: dismissed ? "Login Google dibatalkan." : error.message });
  }
}

export function signOut() {
  invalidateToken();
  writeJson(localStorage, USER_KEY, null);
  setState({ user: null, tokenExpired: false, error: "" });
}

/** Cek token untuk tombol “Periksa token” di halaman Setup. */
export async function checkTokenStatus() {
  try {
    const token = await getAccessToken();
    await fetchProfile(token);
    return { active: true, message: "Token Google aktif dan dapat digunakan." };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return {
        active: false,
        message: "Token Google tidak aktif atau sudah berakhir. Klik “Sambungkan ulang” atau masuk kembali.",
      };
    }
    throw error;
  }
}
