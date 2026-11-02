import { useCallback, useEffect, useRef, useState } from "react";
import { checkTokenStatus, signIn, useSession } from "@/lib/auth";
import { ActionToast } from "@/components/ActionFeedback";
import AppHeader from "@/components/AppHeader";
import Icon from "@/components/Icon";
import SatisfyingArcade from "@/components/SatisfyingArcade";
import SnakeGame from "@/components/SnakeGame";
import { getMiniGameLeaderboards, saveMiniGameHighScore } from "@/lib/miniGameScores";

const MINI_GAMES = [
  {
    id: "slice-shred",
    mode: "slice",
    name: "Slice & Shred",
    description: "Potong bentuk-bentuk neon dan nikmati efek pecahannya.",
    instructions: "Gerakkan mouse melintasi bentuk tanpa klik, atau geser jari di layar.",
  },
  {
    id: "bubble-wrap",
    mode: "pop",
    name: "Bubble Wrap",
    description: "Pecahkan gelembung untuk jeda yang menenangkan.",
    instructions: "Arahkan mouse ke gelembung tanpa klik, atau sentuh dan geser di layar.",
  },
  {
    id: "snake",
    mode: "snake",
    name: "Snake",
    description: "Kumpulkan makanan dan atur tantangan dengan pilihan kecepatan serta rintangan.",
    instructions: "Panah/WASD untuk bergerak. Tahan Space/Shift untuk boost; layar sentuh punya kontrol arah dan boost.",
  },
];

const SNAKE_SPEED_OPTIONS = [
  { id: "slow", name: "Santai", details: "5 poin per makanan" },
  { id: "normal", name: "Normal", details: "10 poin per makanan" },
  { id: "fast", name: "Cepat", details: "15 poin per makanan" },
];
const GAME_MODES = ["freeplay", "competitive"];

function leaderboardKey(gameId, mode) {
  return `${gameId}:${mode}`;
}

function sortedLeaderboard(records) {
  return [...records].sort((left, right) =>
    right.score - left.score ||
    left.updatedAt.localeCompare(right.updatedAt) ||
    left.username.localeCompare(right.username, "id")
  );
}

function SnakeSpeedSettings({ value, onChange }) {
  return (
    <fieldset className="arcade-setting-group snake-speed-settings">
      <legend>Kecepatan Snake</legend>
      {SNAKE_SPEED_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`arcade-mode-option${value === option.id ? " is-selected" : ""}`}
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
        >
          <strong>{option.name}</strong>
          <span>{option.details}</span>
        </button>
      ))}
      <p className="snake-speed-note">
        Tepi arena tersambung di Freeplay; rintangan oranye tetap berbahaya. Tahan Space/Shift atau tombol Boost untuk mempercepat sementara.
      </p>
    </fieldset>
  );
}

function SnakeObstacleSettings({ mode, value, onChange }) {
  return (
    <fieldset className="arcade-setting-group snake-speed-settings">
      <legend>Rintangan</legend>
      {mode === "competitive" ? (
        <div className="snake-obstacle-status" role="status">
          <strong>Selalu aktif · Kompetitif</strong>
          <span>Rintangan acak berpola di empat area, dengan jalur terbuka di antaranya. Semua pemain mendapat pola yang sama setiap hari.</span>
        </div>
      ) : (
        <button
          type="button"
          className={`arcade-mode-option${value ? " is-selected" : ""}`}
          onClick={() => onChange(!value)}
          aria-pressed={value}
        >
          <strong>{value ? "Rintangan aktif" : "Tanpa rintangan"}</strong>
          <span>{value ? "Pola rintangan acak tersusun di beberapa area." : "Arena bebas rintangan; tepi tetap tersambung."}</span>
        </button>
      )}
    </fieldset>
  );
}

function LeaderboardPreview({
  game,
  mode,
  onModeChange,
  records,
  email,
  loading,
  error,
  onRefresh,
  onSignIn,
  compact = false,
}) {
  const latestUpdate = records.reduce((latest, record) => {
    const updatedAt = Date.parse(record.updatedAt);
    return Number.isFinite(updatedAt) && updatedAt > latest ? updatedAt : latest;
  }, 0);

  return (
    <section className={`mini-game-preview${compact ? " is-compact" : ""}`} aria-label={`Leaderboard ${game.name}`}>
      <header className="mini-game-preview-heading">
        <h3><Icon name="crown" size={16} /> {mode === "freeplay" ? "Freeplay" : "Kompetitif"}</h3>
        <button type="button" className="mini-game-refresh" onClick={onRefresh} disabled={!email || loading} aria-label={`Muat ulang leaderboard ${game.name} ${mode}`}>
          <Icon name="reset" size={15} />
        </button>
      </header>
      <div className="mini-game-board-modes" role="group" aria-label={`Mode leaderboard ${game.name}`}>
        {GAME_MODES.map((boardMode) => (
          <button
            key={boardMode}
            type="button"
            className={mode === boardMode ? "is-selected" : ""}
            onClick={() => onModeChange(boardMode)}
            aria-pressed={mode === boardMode}
          >
            {boardMode === "freeplay" ? "Freeplay" : "Kompetitif"}
          </button>
        ))}
      </div>
      <p className="mini-game-preview-meta">
        {latestUpdate ? `Diperbarui ${new Date(latestUpdate).toLocaleString("id-ID")}` : "Skor tertinggi per akun"}
      </p>
      {!email ? (
        <div className="mini-game-board-notice">
          <p>Masuk dengan Google untuk melihat dan menyimpan ranking.</p>
          <button type="button" className="text-button" onClick={onSignIn}>Masuk dengan Google</button>
        </div>
      ) : loading && records.length === 0 ? (
        <p className="mini-game-board-empty" role="status">Memuat ranking...</p>
      ) : error ? (
        <div>
          <p className="mini-game-board-error" role="alert">{error}</p>
          <button type="button" className="text-button" onClick={onSignIn}>Perbarui sesi Google</button>
        </div>
      ) : records.length ? (
        <ol className="mini-game-rank-list">
          {records.slice(0, compact ? 3 : 5).map((record, index) => (
            <li key={record.email} className={record.email === email ? "is-current-user" : ""}>
              <span className="mini-game-rank-number">
                {index === 0 ? <><Icon name="crown" size={15} />1</> : index + 1}
              </span>
              <span className="mini-game-rank-name">
                <strong>{record.username}</strong>
                {record.email === email && <small>Anda</small>}
              </span>
              <span className="mini-game-rank-score">{record.score.toLocaleString("id-ID")}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mini-game-board-empty">{loading ? "Memperbarui ranking..." : "Belum ada skor. Jadilah yang pertama!"}</p>
      )}
    </section>
  );
}

export default function MiniGamesPage() {
  const { data: session, error: authError } = useSession();
  const email = session?.user?.email?.trim().toLowerCase() || "";
  const [activeGameId, setActiveGameId] = useState("");
  const [round, setRound] = useState(0);
  const [gamePhase, setGamePhase] = useState("ready");
  const [countdownValue, setCountdownValue] = useState(3);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState("freeplay");
  const [selectedSnakeSpeed, setSelectedSnakeSpeed] = useState("normal");
  const [selectedSnakeObstacles, setSelectedSnakeObstacles] = useState(true);
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sessionCheck, setSessionCheck] = useState({ status: "idle", message: "" });
  const [score, setScore] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [leaderboardModesByGame, setLeaderboardModesByGame] = useState({});
  const [leaderboardsByGame, setLeaderboardsByGame] = useState({});
  const [leaderboardLoadingByGame, setLeaderboardLoadingByGame] = useState({});
  const [leaderboardErrorsByGame, setLeaderboardErrorsByGame] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const pageRef = useRef(null);
  const savePromiseRef = useRef(null);
  const scoreRef = useRef(0);
  const lastScoreRenderRef = useRef(0);
  const scoreUpdateTimeoutRef = useRef(0);
  const finishingRef = useRef(false);
  const activeGameIdRef = useRef(activeGameId);
  activeGameIdRef.current = activeGameId;

  const activeGame = MINI_GAMES.find((game) => game.id === activeGameId) || null;
  const getLeaderboardMode = (gameId) => leaderboardModesByGame[gameId] || "competitive";
  const setGameLeaderboardMode = (gameId, mode) => {
    setLeaderboardModesByGame((current) => ({ ...current, [gameId]: mode }));
  };
  const activeLeaderboardMode = activeGame ? getLeaderboardMode(activeGame.id) : "competitive";
  const personalBest = activeGame
    ? (leaderboardsByGame[leaderboardKey(activeGame.id, selectedMode)] || []).find((record) => record.email === email)?.score || 0
    : 0;
  useEffect(() => () => window.clearTimeout(scoreUpdateTimeoutRef.current), []);

  const updateGameScore = useCallback((nextScore) => {
    scoreRef.current = nextScore;
    const now = performance.now();
    const wait = 150 - (now - lastScoreRenderRef.current);
    if (wait <= 0) {
      window.clearTimeout(scoreUpdateTimeoutRef.current);
      scoreUpdateTimeoutRef.current = 0;
      lastScoreRenderRef.current = now;
      setScore(nextScore);
    } else if (!scoreUpdateTimeoutRef.current) {
      scoreUpdateTimeoutRef.current = window.setTimeout(() => {
        scoreUpdateTimeoutRef.current = 0;
        lastScoreRenderRef.current = performance.now();
        setScore(scoreRef.current);
      }, wait);
    }
  }, []);

  const loadLeaderboard = useCallback(async (gameId) => {
    const keys = GAME_MODES.map((mode) => leaderboardKey(gameId, mode));
    if (!email) {
      return;
    }

    setLeaderboardLoadingByGame((current) => ({
      ...current,
      ...Object.fromEntries(keys.map((key) => [key, true])),
    }));
    setLeaderboardErrorsByGame((current) => ({
      ...current,
      ...Object.fromEntries(keys.map((key) => [key, ""])),
    }));
    try {
      const leaderboards = await getMiniGameLeaderboards([gameId]);
      setLeaderboardsByGame((current) => ({
        ...current,
        ...Object.fromEntries(GAME_MODES.map((mode) => [
          leaderboardKey(gameId, mode),
          leaderboards[gameId][mode],
        ])),
      }));
    } catch (error) {
      const errorMessage = `${error.message || "Leaderboard gagal dimuat."} Pastikan spreadsheet dibagikan dengan izin Editor ke akun Google Anda.`;
      setLeaderboardErrorsByGame((current) => ({
        ...current,
        ...Object.fromEntries(keys.map((key) => [key, errorMessage])),
      }));
    } finally {
      setLeaderboardLoadingByGame((current) => ({
        ...current,
        ...Object.fromEntries(keys.map((key) => [key, false])),
      }));
    }
  }, [email]);

  const loadAllLeaderboards = useCallback(async () => {
    if (!email) return;
    const keys = MINI_GAMES.flatMap((game) => GAME_MODES.map((mode) => leaderboardKey(game.id, mode)));
    setLeaderboardLoadingByGame((current) => ({
      ...current,
      ...Object.fromEntries(keys.map((key) => [key, true])),
    }));
    setLeaderboardErrorsByGame((current) => ({
      ...current,
      ...Object.fromEntries(keys.map((key) => [key, ""])),
    }));
    try {
      const leaderboards = await getMiniGameLeaderboards(MINI_GAMES.map((game) => game.id));
      setLeaderboardsByGame((current) => ({
        ...current,
        ...Object.fromEntries(MINI_GAMES.flatMap((game) => GAME_MODES.map((mode) => [
          leaderboardKey(game.id, mode),
          leaderboards[game.id][mode],
        ]))),
      }));
    } catch (error) {
      const errorMessage = `${error.message || "Leaderboard gagal dimuat."} Pastikan spreadsheet dibagikan dengan izin Editor ke akun Google Anda.`;
      setLeaderboardErrorsByGame((current) => ({
        ...current,
        ...Object.fromEntries(keys.map((key) => [key, errorMessage])),
      }));
    } finally {
      setLeaderboardLoadingByGame((current) => ({
        ...current,
        ...Object.fromEntries(keys.map((key) => [key, false])),
      }));
    }
  }, [email]);

  useEffect(() => {
    if (!email) return undefined;
    let active = true;
    const refreshBoards = async () => {
      try {
        const status = await checkTokenStatus(60 * 1000);
        if (!active) return;
        if (!status.active) {
          setLeaderboardErrorsByGame((current) => Object.fromEntries(
            MINI_GAMES.flatMap((game) => GAME_MODES.map((mode) => [
              leaderboardKey(game.id, mode),
              status.message || "Sesi Google perlu disambungkan ulang untuk memuat leaderboard.",
            ]))
          ));
          return;
        }
        await loadAllLeaderboards();
      } catch (error) {
        if (!active) return;
        const errorMessage = error.message || "Sesi Google tidak dapat diperiksa. Coba muat ulang leaderboard.";
        setLeaderboardErrorsByGame((current) => Object.fromEntries(
          MINI_GAMES.flatMap((game) => GAME_MODES.map((mode) => [leaderboardKey(game.id, mode), errorMessage]))
        ));
      }
    };
    void refreshBoards();
    const intervalId = window.setInterval(() => void refreshBoards(), 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [email, loadAllLeaderboards]);

  const persistScore = useCallback((scoreValue, game, mode) => {
    if (!email || scoreValue < 1) return Promise.resolve({ saved: false, bestScore: 0 });
    if (savePromiseRef.current) return savePromiseRef.current;

    setSaving(true);
    const operation = (async () => {
      try {
        const result = await saveMiniGameHighScore({
          gameId: game.id,
          game: game.name,
          email,
          score: scoreValue,
          mode,
        });
        const key = leaderboardKey(game.id, mode);
        if (result.record) {
          const updateRecords = (current) => sortedLeaderboard([
            ...(current || []).filter((record) => record.email !== email),
            result.record,
          ]);
          setLeaderboardsByGame((current) => ({
            ...current,
            [key]: updateRecords(current[key]),
          }));
        }
        return result;
      } catch (error) {
        if (error.status === 401) {
          setSessionCheck({ status: "expired", message: "Sesi Google berakhir. Sambungkan ulang agar skor dapat disimpan." });
          return { saved: false, error: "Sesi Google berakhir. Sambungkan ulang akun untuk menyimpan skor." };
        }
        return {
          saved: false,
          error: `${error.message || "High score gagal disimpan."} Pastikan spreadsheet dibagikan dengan izin Editor ke akun Google Anda.`,
        };
      } finally {
        setSaving(false);
      }
    })();

    savePromiseRef.current = operation;
    void operation.then(() => {
      if (savePromiseRef.current === operation) savePromiseRef.current = null;
    });
    return operation;
  }, [email]);

  useEffect(() => {
    function syncFullscreen() {
      setNativeFullscreen(document.fullscreenElement === pageRef.current);
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  async function enterGame(game) {
    setMessage(null);
    setScore(0);
    scoreRef.current = 0;
    window.clearTimeout(scoreUpdateTimeoutRef.current);
    scoreUpdateTimeoutRef.current = 0;
    lastScoreRenderRef.current = 0;
    finishingRef.current = false;
    setRemainingSeconds(60);
    setGamePhase("ready");
    setSettingsOpen(false);
    setShowLeaderboard(false);
    setActiveGameId(game.id);

    setSessionCheck(email
      ? { status: "checking", message: "Memeriksa sesi Google..." }
      : { status: "signed-out", message: "Masuk dengan Google untuk bermain Kompetitif dan menyimpan skor." });
    const tokenCheck = email ? checkTokenStatus(5 * 60 * 1000) : null;
    const fullscreenRequest = pageRef.current?.requestFullscreen && !document.fullscreenElement
      ? pageRef.current.requestFullscreen()
      : Promise.resolve();
    try {
      await fullscreenRequest;
    } catch {
      // The fixed full-viewport game view remains available when native fullscreen is blocked.
    }

    if (!email) {
      setSessionCheck({ status: "signed-out", message: "Masuk dengan Google untuk bermain Kompetitif dan menyimpan skor." });
      return;
    }

    setSessionCheck({ status: "checking", message: "Memeriksa sesi Google..." });
    try {
      const result = await tokenCheck;
      if (activeGameIdRef.current !== game.id) return;
      if (result.active) {
        setSessionCheck({ status: "active", message: "Sesi Google aktif. Skor dapat disimpan." });
        void loadLeaderboard(game.id);
      } else {
        setLeaderboardErrorsByGame((current) => ({
          ...current,
          ...Object.fromEntries(GAME_MODES.map((mode) => [leaderboardKey(game.id, mode), result.message])),
        }));
        setSessionCheck({ status: "expired", message: result.message });
      }
    } catch (error) {
      if (activeGameIdRef.current !== game.id) return;
      const checkMessage = error.message || "Sesi Google tidak dapat diperiksa. Periksa koneksi lalu coba lagi.";
      setLeaderboardErrorsByGame((current) => ({
        ...current,
        ...Object.fromEntries(GAME_MODES.map((mode) => [leaderboardKey(game.id, mode), checkMessage])),
      }));
      setSessionCheck({ status: "error", message: checkMessage });
    }
  }

  async function leaveGame() {
    if (gamePhase === "playing" || gamePhase === "paused") await finishGame();
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        setMessage({ type: "error", text: "Mode fullscreen tidak dapat ditutup. Tekan Esc untuk keluar dari fullscreen browser." });
        return;
      }
    }
    setActiveGameId("");
    setGamePhase("ready");
    setSettingsOpen(false);
    setShowLeaderboard(false);
    setScore(0);
    scoreRef.current = 0;
    window.clearTimeout(scoreUpdateTimeoutRef.current);
    scoreUpdateTimeoutRef.current = 0;
    lastScoreRenderRef.current = 0;
  }

  function beginGame() {
    finishingRef.current = false;
    scoreRef.current = 0;
    window.clearTimeout(scoreUpdateTimeoutRef.current);
    scoreUpdateTimeoutRef.current = 0;
    lastScoreRenderRef.current = 0;
    setScore(0);
    setRemainingSeconds(60);
    setCountdownValue(3);
    setMessage(null);
    setRound((value) => value + 1);
    setGamePhase("countdown");
  }

  async function startGame() {
    if (selectedMode === "competitive") {
      if (!email) {
        setSessionCheck({ status: "signed-out", message: "Masuk dengan Google sebelum memulai mode Kompetitif." });
        return;
      }

      setSessionCheck({ status: "checking", message: "Memastikan sesi Google cukup lama untuk pertandingan..." });
      try {
        const result = await checkTokenStatus(5 * 60 * 1000);
        if (!result.active) {
          setSessionCheck({ status: "expired", message: result.message });
          return;
        }
        setSessionCheck({ status: "active", message: "Sesi Google aktif. Pertandingan dimulai." });
        void loadLeaderboard(activeGame.id);
      } catch (error) {
        setSessionCheck({
          status: "error",
          message: error.message || "Sesi Google tidak dapat diperiksa. Periksa koneksi lalu coba lagi.",
        });
        return;
      }
    }

    beginGame();
  }

  async function refreshGoogleSession() {
    if (!activeGame || !email) return;
    setSessionCheck({ status: "checking", message: "Memeriksa sesi Google..." });
    try {
      const result = await checkTokenStatus(5 * 60 * 1000);
      if (result.active) {
        setSessionCheck({ status: "active", message: "Sesi Google aktif. Skor dapat disimpan." });
        void loadLeaderboard(activeGame.id);
      } else {
        setSessionCheck({ status: "expired", message: result.message });
      }
    } catch (error) {
      setSessionCheck({
        status: "error",
        message: error.message || "Sesi Google tidak dapat diperiksa. Periksa koneksi lalu coba lagi.",
      });
    }
  }

  async function reconnectGoogle() {
    const connected = await signIn();
    if (!connected) return;
    if (email) await refreshGoogleSession();
    else setSessionCheck({ status: "active", message: "Google tersambung. Mulai Kompetitif untuk memeriksa sesi sebelum bermain." });
  }

  const finishGame = useCallback(async () => {
    if (finishingRef.current || !activeGame) return;
    finishingRef.current = true;
    const finalScore = scoreRef.current;
    window.clearTimeout(scoreUpdateTimeoutRef.current);
    scoreUpdateTimeoutRef.current = 0;
    setScore(finalScore);
    setGamePhase("results");
    setShowLeaderboard(false);
    if (!email) {
      setMessage({
        type: "error",
        text: finalScore > 0
          ? "Sesi berakhir. Skor tidak tersimpan karena Anda belum masuk dengan Google."
          : "Sesi berakhir tanpa skor untuk disimpan.",
      });
      return;
    }
    if (finalScore < 1) {
      setMessage({ type: "success", text: "Sesi berakhir tanpa skor untuk disimpan." });
      return;
    }

    const result = await persistScore(finalScore, activeGame, selectedMode);
    if (result.error) {
      setMessage({ type: "error", text: `Skor sesi tidak tersimpan. ${result.error}` });
    } else if (result.saved) {
      setMessage({
        type: "success",
        text: `High score ${selectedMode === "freeplay" ? "Freeplay" : "Kompetitif"} baru (${finalScore.toLocaleString("id-ID")}) tersimpan.`,
      });
    } else {
      setMessage({
        type: "success",
        text: `Sesi selesai. Skor tidak melampaui rekor ${selectedMode === "freeplay" ? "Freeplay" : "Kompetitif"} (${result.bestScore.toLocaleString("id-ID")}); tidak ada pembaruan.`,
      });
    }
  }, [activeGame, email, persistScore, selectedMode]);

  useEffect(() => {
    if (gamePhase !== "countdown") return undefined;

    const timer = window.setTimeout(() => {
      if (countdownValue <= 1) {
        setGamePhase("playing");
      } else {
        setCountdownValue((value) => value - 1);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdownValue, gamePhase]);

  useEffect(() => {
    if (gamePhase !== "playing" || selectedMode !== "competitive") return undefined;

    const timer = window.setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [gamePhase, selectedMode]);

  useEffect(() => {
    if (gamePhase === "playing" && selectedMode === "competitive" && remainingSeconds === 0) {
      void finishGame();
    }
  }, [finishGame, gamePhase, remainingSeconds, selectedMode]);

  function pauseGame() {
    setScore(scoreRef.current);
    setGamePhase("paused");
    setSettingsOpen(false);
    setShowLeaderboard(false);
  }

  function resumeGame() {
    setSettingsOpen(false);
    setCountdownValue(3);
    setGamePhase("countdown");
  }

  async function returnToMenu() {
    await finishGame();
    setGamePhase("ready");
    setSettingsOpen(false);
    setShowLeaderboard(false);
    setScore(0);
    scoreRef.current = 0;
    window.clearTimeout(scoreUpdateTimeoutRef.current);
    scoreUpdateTimeoutRef.current = 0;
    lastScoreRenderRef.current = 0;
  }

  function openSettingsFromResults() {
    setSettingsOpen(true);
    setGamePhase("ready");
  }

  function openMainMenuFromResults() {
    setSettingsOpen(false);
    setGamePhase("ready");
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await pageRef.current?.requestFullscreen?.();
    } catch {
      setMessage({ type: "error", text: "Browser tidak dapat mengubah mode fullscreen." });
    }
  }

  const activeLeaderboardKey = activeGame ? leaderboardKey(activeGame.id, activeLeaderboardMode) : "";
  const activeLeaderboard = activeLeaderboardKey ? (leaderboardsByGame[activeLeaderboardKey] || []) : [];
  const activeLeaderboardLoading = Boolean(leaderboardLoadingByGame[activeLeaderboardKey]);
  const activeLeaderboardError = leaderboardErrorsByGame[activeLeaderboardKey] || "";
  const topPlayers = activeLeaderboard.slice(0, 10);
  const selectedSnakeSpeedOption = SNAKE_SPEED_OPTIONS.find((option) => option.id === selectedSnakeSpeed);

  return (
    <main ref={pageRef} className={`mini-games-page${activeGame ? " is-playing" : ""}`}>
      {!activeGame ? (
        <div className="app-shell">
          <AppHeader />
          <div className="page-content workspace-content mini-game-menu">
            <section className="page-intro mini-games-intro">
              <div>
                <p className="page-eyebrow"><span />Waktu jeda</p>
                <h1>Pilih <em>game.</em></h1>
                <p className="page-subtitle">Ambil jeda sejenak dengan game singkat yang menenangkan.</p>
              </div>
            </section>
            {message && <ActionToast message={message} onClose={() => setMessage(null)} />}
            <div className="mini-game-picker" aria-label="Pilih mini game">
              {MINI_GAMES.map((game, index) => (
                <article
                  key={game.id}
                  className="mini-game-card"
                >
                  <span className="mini-game-card-number">0{index + 1} · MINI GAME</span>
                  <strong>{game.name}</strong>
                  <span>{game.description}</span>
                  <button type="button" className="mini-game-launch" onClick={() => void enterGame(game)}>
                    <Icon name="gamepad" size={16} /> Mulai permainan
                  </button>
                  <LeaderboardPreview
                    game={game}
                    mode={getLeaderboardMode(game.id)}
                    onModeChange={(mode) => setGameLeaderboardMode(game.id, mode)}
                    records={leaderboardsByGame[leaderboardKey(game.id, getLeaderboardMode(game.id))] || []}
                    email={email}
                    loading={Boolean(leaderboardLoadingByGame[leaderboardKey(game.id, getLeaderboardMode(game.id))])}
                    error={leaderboardErrorsByGame[leaderboardKey(game.id, getLeaderboardMode(game.id))] || ""}
                    onRefresh={() => void loadLeaderboard(game.id)}
                    onSignIn={() => void signIn("google")}
                    compact
                  />
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : gamePhase === "ready" ? (
        <section className="arcade-start-screen">
          <header className="arcade-start-header">
            <button type="button" className="arcade-game-back" onClick={() => void leaveGame()}>
              <Icon name="close" size={17} />
              <span>Quit game</span>
            </button>
            <span>MENU GAME</span>
          </header>
          <div className="arcade-start-card">
            {message && <ActionToast message={message} onClose={() => setMessage(null)} />}
            <span className="arcade-start-eyebrow">MINI GAME</span>
            <h1>{activeGame.name}</h1>
            <p>{activeGame.description}</p>
            {sessionCheck.status !== "idle" && sessionCheck.status !== "active" && (
              <div className={`arcade-auth-notice is-${sessionCheck.status}`} role={sessionCheck.status === "expired" || sessionCheck.status === "error" ? "alert" : "status"}>
                <p>{authError || sessionCheck.message}</p>
                {(sessionCheck.status === "signed-out" || sessionCheck.status === "expired") && (
                  <button type="button" onClick={() => void reconnectGoogle()}>
                    {email ? "Sambungkan ulang Google" : "Masuk dengan Google"}
                  </button>
                )}
                {sessionCheck.status === "error" && email && (
                  <button type="button" onClick={() => void refreshGoogleSession()}>Coba periksa lagi</button>
                )}
              </div>
            )}
            {settingsOpen ? (
              <div className="arcade-settings">
                <fieldset className="arcade-setting-group">
                  <legend>Mode permainan</legend>
                  <button
                    type="button"
                    className={`arcade-mode-option${selectedMode === "freeplay" ? " is-selected" : ""}`}
                    onClick={() => setSelectedMode("freeplay")}
                    aria-pressed={selectedMode === "freeplay"}
                  >
                    <strong>Freeplay</strong>
                    <span>Bermain tanpa batas waktu. Rekor Freeplay disimpan saat sesi berakhir.</span>
                  </button>
                  <button
                    type="button"
                    className={`arcade-mode-option${selectedMode === "competitive" ? " is-selected" : ""}`}
                    onClick={() => setSelectedMode("competitive")}
                    aria-pressed={selectedMode === "competitive"}
                  >
                    <strong>Kompetitif · 60 detik</strong>
                    <span>Kejar skor tertinggi. Skor akhir disimpan ke leaderboard Kompetitif.</span>
                  </button>
                </fieldset>
                {activeGame.mode === "snake" && (
                  <>
                    <SnakeSpeedSettings value={selectedSnakeSpeed} onChange={setSelectedSnakeSpeed} />
                    <SnakeObstacleSettings
                      mode={selectedMode}
                      value={selectedSnakeObstacles}
                      onChange={setSelectedSnakeObstacles}
                    />
                  </>
                )}
                <div className="arcade-setting-effects">
                  <div>
                    <strong>Efek visual</strong>
                    <span>Partikel ringan, kilau neon, dan getaran halus.</span>
                  </div>
                  <button
                    type="button"
                    className={`arcade-setting-toggle${effectsEnabled ? " is-enabled" : ""}`}
                    onClick={() => setEffectsEnabled((enabled) => !enabled)}
                    aria-pressed={effectsEnabled}
                  >
                    {effectsEnabled ? "Aktif" : "Nonaktif"}
                  </button>
                </div>
                <div className="arcade-setting-effects">
                  <div>
                    <strong>Suara</strong>
                    <span>Efek audio saat bermain.</span>
                  </div>
                  <button
                    type="button"
                    className={`arcade-setting-toggle${soundEnabled ? " is-enabled" : ""}`}
                    onClick={() => setSoundEnabled((enabled) => !enabled)}
                    aria-pressed={soundEnabled}
                  >
                    {soundEnabled ? "Aktif" : "Nonaktif"}
                  </button>
                </div>
                <button type="button" className="arcade-start-secondary" onClick={() => setSettingsOpen(false)}>
                  {gamePhase === "paused" ? "Kembali ke Pause" : "Kembali"}
                </button>
              </div>
            ) : (
              <div className="arcade-start-actions">
                <button
                  type="button"
                  className="arcade-start-primary"
                  onClick={startGame}
                  disabled={selectedMode === "competitive" && sessionCheck.status === "checking"}
                >
                  <Icon name="gamepad" size={18} />
                  {selectedMode === "competitive" && sessionCheck.status === "checking" ? "Memeriksa sesi..." : "Mulai"}
                </button>
                <button type="button" className="arcade-start-secondary" onClick={() => setSettingsOpen(true)}>
                  <Icon name="settings" size={17} />
                  Settings
                </button>
                <button type="button" className="arcade-start-secondary" onClick={() => void leaveGame()}>
                  <Icon name="close" size={17} />
                  Quit game
                </button>
              </div>
            )}
          </div>
          <div className="arcade-menu-leaderboard">
            <LeaderboardPreview
              game={activeGame}
              mode={getLeaderboardMode(activeGame.id)}
              onModeChange={(mode) => setGameLeaderboardMode(activeGame.id, mode)}
              records={leaderboardsByGame[leaderboardKey(activeGame.id, getLeaderboardMode(activeGame.id))] || []}
              email={email}
              loading={Boolean(leaderboardLoadingByGame[leaderboardKey(activeGame.id, getLeaderboardMode(activeGame.id))])}
              error={leaderboardErrorsByGame[leaderboardKey(activeGame.id, getLeaderboardMode(activeGame.id))] || ""}
              onRefresh={() => void loadLeaderboard(activeGame.id)}
              onSignIn={() => void signIn("google")}
            />
          </div>
        </section>
      ) : (
        <>
          <header className="arcade-game-header">
            <div className="arcade-game-mode">
              <span>{selectedMode === "competitive" ? "KOMPETITIF" : "FREEPLAY"}</span>
              <strong>{selectedMode === "competitive" ? "60 detik" : "Tanpa batas waktu"}</strong>
            </div>
            <div className="arcade-game-title">
              <span>MINI GAME</span>
              <strong>{activeGame.name}</strong>
            </div>
            <div className="arcade-game-score">
              <span>SKOR</span>
              <strong>{score.toLocaleString("id-ID")}</strong>
            </div>
            <div className="arcade-game-actions">
              {selectedMode === "competitive" && (
                <span className={`arcade-game-timer${remainingSeconds <= 10 ? " is-urgent" : ""}`} aria-live="polite">
                  {remainingSeconds}s
                </span>
              )}
              <button
                type="button"
                className={`arcade-game-action${showLeaderboard ? " is-active" : ""}`}
                onClick={() => setShowLeaderboard((visible) => !visible)}
                aria-expanded={showLeaderboard}
              >
                <Icon name="reports" size={16} />
                <span>Ranking</span>
              </button>
              <button type="button" className="arcade-game-action arcade-fullscreen-action" onClick={() => void toggleFullscreen()}>
                <Icon name={nativeFullscreen ? "fullscreenExit" : "fullscreen"} size={16} />
                <span>{nativeFullscreen ? "Keluar fullscreen" : "Fullscreen"}</span>
              </button>
              {gamePhase === "playing" && (
                <button type="button" className="arcade-game-action" onClick={pauseGame}>
                  <Icon name="pause" size={16} />
                  <span>Pause</span>
                </button>
              )}
            </div>
          </header>
          <div className="arcade-game-stage">
            {(gamePhase === "playing" || gamePhase === "paused" || gamePhase === "countdown") && (
              activeGame.mode === "snake" ? (
                <SnakeGame
                  key={`${activeGame.id}-${round}`}
                  onScoreChange={updateGameScore}
                  onGameOver={() => void finishGame()}
                  effectsEnabled={effectsEnabled}
                  paused={gamePhase !== "playing"}
                  mode={selectedMode}
                  speed={selectedSnakeSpeed}
                  obstaclesEnabled={selectedSnakeObstacles}
                />
              ) : (
                <SatisfyingArcade
                  key={`${activeGame.id}-${round}`}
                  mode={activeGame.mode}
                  onScoreChange={updateGameScore}
                  interactionDisabled={saving}
                  effectsEnabled={effectsEnabled}
                  soundEnabled={soundEnabled}
                  paused={gamePhase !== "playing"}
                />
              )
            )}
            {gamePhase === "countdown" && (
              <div className="arcade-session-overlay arcade-countdown-overlay" aria-live="assertive" aria-atomic="true">
                <section className="arcade-countdown" role="status" key={countdownValue}>
                  <span>Bersiap</span>
                  <strong>{countdownValue}</strong>
                </section>
              </div>
            )}
            {gamePhase === "paused" && !settingsOpen && (
              <div className="arcade-session-overlay">
                <section className="arcade-session-dialog" role="dialog" aria-modal="true" aria-labelledby="arcade-pause-title">
                  <span className="arcade-start-eyebrow">SESI DIJEDA</span>
                  <h2 id="arcade-pause-title">Istirahat sebentar?</h2>
                  <p>Skor saat ini: <strong className="arcade-overlay-score">{score.toLocaleString("id-ID")}</strong></p>
                  <p>{selectedMode === "competitive" ? `Waktu tersisa ${remainingSeconds} detik.` : "Permainan akan dilanjutkan dari posisi terakhir."}</p>
                  <button type="button" className="arcade-start-primary" onClick={resumeGame}>
                    <Icon name="play" size={17} />
                    Lanjutkan
                  </button>
                  <button type="button" className="arcade-start-secondary" onClick={() => setSettingsOpen(true)}>
                    <Icon name="settings" size={17} />
                    Settings
                  </button>
                  <button type="button" className="arcade-start-secondary" onClick={() => void finishGame()}>
                    Akhiri sesi
                  </button>
                  <button type="button" className="arcade-start-secondary" onClick={() => void returnToMenu()} disabled={saving}>
                    Main menu
                  </button>
                  <button type="button" className="arcade-start-secondary" onClick={() => void leaveGame()} disabled={saving}>
                    Quit game
                  </button>
                </section>
              </div>
            )}
            {gamePhase === "paused" && settingsOpen && (
              <div className="arcade-session-overlay">
                <section className="arcade-session-dialog arcade-pause-settings" role="dialog" aria-modal="true" aria-labelledby="arcade-pause-settings-title">
                  <span className="arcade-start-eyebrow">PENGATURAN</span>
                  <h2 id="arcade-pause-settings-title">Settings</h2>
                  {activeGame.mode === "snake" && (
                    <SnakeSpeedSettings value={selectedSnakeSpeed} onChange={setSelectedSnakeSpeed} />
                  )}
                  <div className="arcade-setting-effects">
                    <div>
                      <strong>Efek visual</strong>
                      <span>Partikel ringan, kilau neon, dan getaran halus.</span>
                    </div>
                    <button
                      type="button"
                      className={`arcade-setting-toggle${effectsEnabled ? " is-enabled" : ""}`}
                      onClick={() => setEffectsEnabled((enabled) => !enabled)}
                      aria-pressed={effectsEnabled}
                    >
                      {effectsEnabled ? "Aktif" : "Nonaktif"}
                    </button>
                  </div>
                  <div className="arcade-setting-effects">
                    <div>
                      <strong>Suara</strong>
                      <span>Efek audio saat bermain.</span>
                    </div>
                    <button
                      type="button"
                      className={`arcade-setting-toggle${soundEnabled ? " is-enabled" : ""}`}
                      onClick={() => setSoundEnabled((enabled) => !enabled)}
                      aria-pressed={soundEnabled}
                    >
                      {soundEnabled ? "Aktif" : "Nonaktif"}
                    </button>
                  </div>
                  <button type="button" className="arcade-start-secondary" onClick={() => setSettingsOpen(false)}>
                    Kembali ke Pause
                  </button>
                </section>
              </div>
            )}
            {gamePhase === "results" && (
              <div className="arcade-session-overlay">
                <section className="arcade-session-dialog" role="dialog" aria-modal="true" aria-labelledby="arcade-result-title">
                  <span className="arcade-start-eyebrow">HASIL AKHIR</span>
                  <h2 id="arcade-result-title">{activeGame.name}</h2>
                  <p className="arcade-final-score">{score.toLocaleString("id-ID")}</p>
                  <p>
                    {saving
                      ? "Menyimpan skor akhir ke leaderboard..."
                      : (email
                        ? `Skor ${selectedMode === "freeplay" ? "Freeplay" : "Kompetitif"} telah difinalisasi.`
                        : "Masuk dengan Google untuk menyimpan skor ke leaderboard.")}
                  </p>
                  <button type="button" className="arcade-start-primary" onClick={startGame}>
                    <Icon name="reset" size={17} />
                    Main lagi
                  </button>
                  <button type="button" className="arcade-start-secondary" onClick={openSettingsFromResults}>
                    <Icon name="settings" size={17} />
                    Settings
                  </button>
                  <button type="button" className="arcade-start-secondary" onClick={openMainMenuFromResults}>
                    Main menu
                  </button>
                  <button type="button" className="arcade-start-secondary" onClick={() => void leaveGame()}>
                    <Icon name="close" size={17} />
                    Quit game
                  </button>
                </section>
              </div>
            )}
          </div>
          <footer className="arcade-game-footer">
            <span>
              {activeGame.mode === "snake"
                ? `${selectedSnakeSpeedOption.name} · ${selectedSnakeSpeedOption.details} | ${activeGame.instructions}`
                : activeGame.instructions}
            </span>
            <span>
              {selectedMode === "competitive"
                ? (email ? `Rekor kompetitif ${personalBest.toLocaleString("id-ID")}` : "Masuk dengan Google untuk menyimpan high score.")
                : (email ? "Rekor Freeplay diperbarui setelah sesi berakhir." : "Masuk dengan Google untuk menyimpan rekor Freeplay.")}
            </span>
          </footer>
          {showLeaderboard && (
            <aside className="mini-game-leaderboard arcade-leaderboard" aria-labelledby="mini-game-leaderboard-title">
              <div className="mini-game-leaderboard-heading">
                <div>
                  <span className="panel-eyebrow">Papan peringkat</span>
                  <h2 id="mini-game-leaderboard-title">{activeGame.name}</h2>
                </div>
                <button type="button" className="mini-game-refresh" onClick={() => void loadLeaderboard(activeGame.id)} disabled={!email || activeLeaderboardLoading} aria-label={`Muat ulang leaderboard ${activeLeaderboardMode}`}>
                  <Icon name="reset" size={16} />
                </button>
              </div>
              <div className="mini-game-board-modes" role="group" aria-label="Mode leaderboard">
                {GAME_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={activeLeaderboardMode === mode ? "is-selected" : ""}
                    onClick={() => setGameLeaderboardMode(activeGame.id, mode)}
                    aria-pressed={activeLeaderboardMode === mode}
                  >
                    {mode === "freeplay" ? "Freeplay" : "Kompetitif"}
                  </button>
                ))}
              </div>
              {!email ? (
                <div className="mini-game-board-notice">
                  <p>Masuk dengan akun Google untuk melihat dan menyimpan ranking.</p>
                  <button type="button" className="text-button" onClick={() => signIn("google")}>Masuk dengan Google</button>
                </div>
              ) : activeLeaderboardLoading && !leaderboardsByGame[activeLeaderboardKey] ? (
                <p className="mini-game-board-empty" role="status">Memuat ranking...</p>
              ) : activeLeaderboardError ? (
                <p className="mini-game-board-error" role="alert">{activeLeaderboardError}</p>
              ) : topPlayers.length ? (
                <ol className="mini-game-rank-list">
                  {topPlayers.map((record, index) => (
                    <li key={record.email} className={record.email === email ? "is-current-user" : ""}>
                      <span className="mini-game-rank-number">{index + 1}</span>
                      <span className="mini-game-rank-name">
                        <strong>{record.username}</strong>
                        {record.email === email && <small>Anda</small>}
                      </span>
                      <span className="mini-game-rank-score">{record.score.toLocaleString("id-ID")}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mini-game-board-empty">{activeLeaderboardLoading ? "Memperbarui ranking..." : "Belum ada skor. Jadilah yang pertama!"}</p>
              )}
              {email && <p className="mini-game-sheet-note">Skor tertinggi per akun dan mode tersimpan di spreadsheet tim.</p>}
            </aside>
          )}
          {message && <ActionToast message={message} onClose={() => setMessage(null)} />}
        </>
      )}
    </main>
  );
}
