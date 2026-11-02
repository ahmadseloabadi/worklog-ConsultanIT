import { useEffect, useRef } from "react";

const COLUMNS = 24;
const ROWS = 18;
const SPEEDS = {
  slow: { interval: 155, points: 5 },
  normal: { interval: 125, points: 10 },
  fast: { interval: 95, points: 15 },
};
const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
};

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

function generateObstacles(enabled, seed) {
  if (!enabled) return [];
  const random = createRandom(seed);
  const zones = [
    { minX: 2, maxX: 9, minY: 2, maxY: 6 },
    { minX: 14, maxX: 21, minY: 2, maxY: 6 },
    { minX: 2, maxX: 9, minY: 11, maxY: 16 },
    { minX: 14, maxX: 21, minY: 11, maxY: 16 },
  ];

  return zones.flatMap((zone) => {
    const horizontal = random() >= 0.5;
    const length = 3 + Math.floor(random() * 3);
    const maxStartX = horizontal ? zone.maxX - length + 1 : zone.maxX;
    const maxStartY = horizontal ? zone.maxY : zone.maxY - length + 1;
    const startX = zone.minX + Math.floor(random() * (maxStartX - zone.minX + 1));
    const startY = zone.minY + Math.floor(random() * (maxStartY - zone.minY + 1));
    return Array.from({ length }, (_, index) => ({
      x: startX + (horizontal ? index : 0),
      y: startY + (horizontal ? 0 : index),
    }));
  });
}

function createFood(snake, obstacles) {
  const available = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLUMNS; x += 1) {
      const onSnake = snake.some((segment) => segment.x === x && segment.y === y);
      const onObstacle = obstacles.some((obstacle) => obstacle.x === x && obstacle.y === y);
      if (!onSnake && !onObstacle) available.push({ x, y });
    }
  }
  return available.length ? available[Math.floor(Math.random() * available.length)] : null;
}

export default function SnakeGame({
  onScoreChange,
  onGameOver,
  paused = false,
  effectsEnabled = true,
  mode = "freeplay",
  speed = "normal",
  obstaclesEnabled = true,
}) {
  const canvasRef = useRef(null);
  const runtimeRef = useRef(null);
  const animationFrameRef = useRef(0);
  const loopRef = useRef(null);
  const pausedRef = useRef(paused);
  const effectsRef = useRef(effectsEnabled);
  const onScoreChangeRef = useRef(onScoreChange);
  const onGameOverRef = useRef(onGameOver);
  const speedRef = useRef(speed);
  const modeRef = useRef(mode);
  const obstaclesEnabledRef = useRef(obstaclesEnabled);

  pausedRef.current = paused;
  effectsRef.current = effectsEnabled;
  onScoreChangeRef.current = onScoreChange;
  onGameOverRef.current = onGameOver;
  speedRef.current = speed;
  modeRef.current = mode;
  obstaclesEnabledRef.current = obstaclesEnabled;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    const runtime = {
      width: 0,
      height: 0,
      cellSize: 0,
      offsetX: 0,
      offsetY: 0,
      obstacles: [],
      lastFrameAt: 0,
      moveAccumulator: 0,
      snake: [
        { x: 9, y: 9 },
        { x: 8, y: 9 },
        { x: 7, y: 9 },
        { x: 6, y: 9 },
      ],
      direction: { x: 1, y: 0 },
      nextDirection: { x: 1, y: 0 },
      food: null,
      score: 0,
      started: false,
      boost: false,
      gameOver: false,
    };
    const isCompetitive = modeRef.current === "competitive";
    const seedText = isCompetitive
      ? new Date().toISOString().slice(0, 10)
      : `${Date.now()}-${Math.random()}`;
    runtime.obstacles = generateObstacles(
      isCompetitive || obstaclesEnabledRef.current,
      hashSeed(seedText)
    );
    runtimeRef.current = runtime;

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      runtime.width = bounds.width;
      runtime.height = bounds.height;
      runtime.cellSize = Math.floor(Math.min(bounds.width / COLUMNS, bounds.height / ROWS));
      runtime.offsetX = Math.floor((bounds.width - runtime.cellSize * COLUMNS) / 2);
      runtime.offsetY = Math.floor((bounds.height - runtime.cellSize * ROWS) / 2);
      canvas.width = Math.round(bounds.width * pixelRatio);
      canvas.height = Math.round(bounds.height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      render(performance.now());
    }

    function setDirection(nextDirection) {
      if (runtime.gameOver || pausedRef.current) return;
      const current = runtime.nextDirection;
      if (current.x + nextDirection.x === 0 && current.y + nextDirection.y === 0) return;
      runtime.nextDirection = nextDirection;
      runtime.started = true;
    }

    function handleKeyDown(event) {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === " " || key === "shift") {
        event.preventDefault();
        runtime.boost = true;
        return;
      }
      const direction = DIRECTIONS[key];
      if (!direction) return;
      event.preventDefault();
      setDirection(direction);
    }

    function handleKeyUp(event) {
      if (event.key === " " || event.key === "Shift") runtime.boost = false;
    }

    function handleWindowBlur() {
      runtime.boost = false;
    }

    function finish() {
      if (runtime.gameOver) return;
      runtime.gameOver = true;
      onGameOverRef.current();
    }

    function move() {
      if (runtime.gameOver) return;
      runtime.direction = runtime.nextDirection;
      const head = runtime.snake[0];
      let nextHead = { x: head.x + runtime.direction.x, y: head.y + runtime.direction.y };
      if (modeRef.current === "freeplay") {
        nextHead = {
          x: (nextHead.x + COLUMNS) % COLUMNS,
          y: (nextHead.y + ROWS) % ROWS,
        };
      }
      const eating = nextHead.x === runtime.food?.x && nextHead.y === runtime.food?.y;
      const collisionBody = eating ? runtime.snake : runtime.snake.slice(0, -1);
      const hitWall = modeRef.current !== "freeplay" && (
        nextHead.x < 0 || nextHead.x >= COLUMNS || nextHead.y < 0 || nextHead.y >= ROWS
      );
      const hitSelf = collisionBody.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);
      const hitObstacle = runtime.obstacles.some((obstacle) => obstacle.x === nextHead.x && obstacle.y === nextHead.y);

      if (hitWall || hitSelf || hitObstacle) {
        finish();
        return;
      }

      runtime.snake.unshift(nextHead);
      if (eating) {
        runtime.score += SPEEDS[speedRef.current].points;
        runtime.food = createFood(runtime.snake, runtime.obstacles);
        onScoreChangeRef.current(runtime.score);
        if (!runtime.food) finish();
      } else {
        runtime.snake.pop();
      }
    }

    function render(now) {
      if (!runtime.cellSize) return;
      const { width, height, cellSize, offsetX, offsetY } = runtime;
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#0b0c10";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#101722";
      context.fillRect(offsetX, offsetY, cellSize * COLUMNS, cellSize * ROWS);

      if (modeRef.current !== "freeplay") {
        context.strokeStyle = "rgba(151, 174, 193, 0.055)";
        context.lineWidth = 1;
        context.beginPath();
        for (let x = 0; x <= COLUMNS; x += 1) {
          const gridX = offsetX + x * cellSize;
          context.moveTo(gridX, offsetY);
          context.lineTo(gridX, offsetY + ROWS * cellSize);
        }
        for (let y = 0; y <= ROWS; y += 1) {
          const gridY = offsetY + y * cellSize;
          context.moveTo(offsetX, gridY);
          context.lineTo(offsetX + COLUMNS * cellSize, gridY);
        }
        context.stroke();
        context.strokeStyle = "rgba(81, 242, 213, 0.48)";
        context.lineWidth = 2;
        context.strokeRect(offsetX, offsetY, cellSize * COLUMNS, cellSize * ROWS);
      }

      runtime.obstacles.forEach((obstacle) => {
        const inset = Math.max(2, cellSize * 0.1);
        const x = offsetX + obstacle.x * cellSize + inset;
        const y = offsetY + obstacle.y * cellSize + inset;
        const size = cellSize - inset * 2;
        context.beginPath();
        context.roundRect(x, y, size, size, Math.max(2, cellSize * 0.16));
        context.fillStyle = "#ff9f43";
        context.shadowColor = "#ff9f43";
        context.shadowBlur = effectsRef.current ? 7 : 0;
        context.fill();
      });
      context.shadowBlur = 0;

      if (runtime.food) {
        const pulse = 0.9 + Math.sin(now / 130) * 0.07;
        const centerX = offsetX + (runtime.food.x + 0.5) * cellSize;
        const centerY = offsetY + (runtime.food.y + 0.5) * cellSize;
        const radius = cellSize * 0.3 * pulse;
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.fillStyle = "#ff6685";
        context.shadowColor = "#ff6685";
        context.shadowBlur = effectsRef.current ? 12 : 0;
        context.fill();
        context.shadowBlur = 0;
        context.beginPath();
        context.arc(centerX - radius * 0.28, centerY - radius * 0.3, radius * 0.18, 0, Math.PI * 2);
        context.fillStyle = "rgba(255,255,255,.8)";
        context.fill();
      }

      const tailIndex = runtime.snake.length - 1;
      runtime.snake.forEach((segment, index) => {
        const inset = Math.max(2, cellSize * 0.09);
        const tail = index === tailIndex;
        const segmentInset = tail ? cellSize * 0.2 : inset;
        const x = offsetX + segment.x * cellSize + segmentInset;
        const y = offsetY + segment.y * cellSize + segmentInset;
        const size = cellSize - segmentInset * 2;
        context.beginPath();
        context.roundRect(x, y, size, size, Math.max(2, cellSize * (tail ? 0.5 : 0.2)));
        context.fillStyle = index === 0 ? "#70ffe1" : tail ? "#137c76" : "#20cfb6";
        context.shadowColor = "#00f5d4";
        context.shadowBlur = effectsRef.current ? (index === 0 ? 13 : 5) : 0;
        context.fill();
      });
      context.shadowBlur = 0;

      const head = runtime.snake[0];
      const headCenterX = offsetX + (head.x + 0.5) * cellSize;
      const headCenterY = offsetY + (head.y + 0.5) * cellSize;
      const eyeForward = cellSize * 0.2;
      const eyeSide = cellSize * 0.16;
      const eyeRadius = Math.max(1.5, cellSize * 0.065);
      [-1, 1].forEach((side) => {
        const eyeX = headCenterX + runtime.direction.x * eyeForward - runtime.direction.y * eyeSide * side;
        const eyeY = headCenterY + runtime.direction.y * eyeForward + runtime.direction.x * eyeSide * side;
        context.beginPath();
        context.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
        context.fillStyle = "#083c3a";
        context.fill();
      });

      if (runtime.gameOver) {
        context.fillStyle = "rgba(4, 8, 14, 0.62)";
        context.fillRect(offsetX, offsetY, cellSize * COLUMNS, cellSize * ROWS);
        context.fillStyle = "#fff";
        context.font = "700 24px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("Permainan berakhir", width / 2, height / 2);
      }
    }

    function animate(now) {
      if (pausedRef.current) return;
      if (!runtime.lastFrameAt) runtime.lastFrameAt = now;
      runtime.moveAccumulator += Math.min(now - runtime.lastFrameAt, 100);
      runtime.lastFrameAt = now;
      const baseInterval = SPEEDS[speedRef.current].interval;
      const stepInterval = Math.max(55, baseInterval - Math.floor(runtime.score / 50) * 4) * (runtime.boost ? 0.55 : 1);
      while (runtime.started && runtime.moveAccumulator >= stepInterval && !runtime.gameOver) {
        move();
        runtime.moveAccumulator -= stepInterval;
      }
      render(now);
      if (!runtime.gameOver) animationFrameRef.current = window.requestAnimationFrame(animate);
    }

    runtime.food = createFood(runtime.snake, runtime.obstacles);
    loopRef.current = () => {
      runtime.lastFrameAt = 0;
      runtime.moveAccumulator = 0;
      animationFrameRef.current = window.requestAnimationFrame(animate);
    };
    resize();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("resize", resize);
      observer.disconnect();
      runtimeRef.current = null;
      loopRef.current = null;
    };
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused && runtimeRef.current) runtimeRef.current.boost = false;
    if (!paused && runtimeRef.current) runtimeRef.current.started = true;
    window.cancelAnimationFrame(animationFrameRef.current);
    if (!paused) loopRef.current?.();
    return () => window.cancelAnimationFrame(animationFrameRef.current);
  }, [paused]);

  function steer(direction) {
    const game = runtimeRef.current;
    if (!game || game.gameOver || pausedRef.current) return;
    const nextDirection = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    }[direction];
    const current = game.nextDirection;
    if (current.x + nextDirection.x === 0 && current.y + nextDirection.y === 0) return;
    game.nextDirection = nextDirection;
    game.started = true;
  }

  function setBoost(active) {
    if (runtimeRef.current && !pausedRef.current && !runtimeRef.current.gameOver) {
      runtimeRef.current.boost = active;
    }
  }

  return (
    <div className="snake-game">
      <canvas ref={canvasRef} className={`snake-canvas${mode === "freeplay" ? " is-freeplay" : ""}`} aria-label="Permainan Snake. Gunakan tombol panah atau WASD untuk menggerakkan ular." />
      <div className="snake-touch-controls" aria-label="Kontrol Snake">
        <button type="button" onClick={() => steer("up")} aria-label="Gerak ke atas">▲</button>
        <div>
          <button type="button" onClick={() => steer("left")} aria-label="Gerak ke kiri">◀</button>
          <button type="button" onClick={() => steer("down")} aria-label="Gerak ke bawah">▼</button>
          <button type="button" onClick={() => steer("right")} aria-label="Gerak ke kanan">▶</button>
        </div>
        <button
          type="button"
          className="snake-boost-button"
          onPointerDown={(event) => {
            event.preventDefault();
            setBoost(true);
          }}
          onPointerUp={() => setBoost(false)}
          onPointerLeave={() => setBoost(false)}
          onPointerCancel={() => setBoost(false)}
          aria-label="Tahan untuk mempercepat ular"
        >
          Tahan untuk Boost
        </button>
      </div>
    </div>
  );
}
