import { useEffect, useRef } from "react";

const COLUMNS = 24;
const ROWS = 18;
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

function createFood(snake) {
  const available = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLUMNS; x += 1) {
      if (!snake.some((segment) => segment.x === x && segment.y === y)) available.push({ x, y });
    }
  }
  return available.length ? available[Math.floor(Math.random() * available.length)] : null;
}

export default function SnakeGame({ onScoreChange, onGameOver, paused = false, effectsEnabled = true }) {
  const canvasRef = useRef(null);
  const runtimeRef = useRef(null);
  const animationFrameRef = useRef(0);
  const loopRef = useRef(null);
  const pausedRef = useRef(paused);
  const effectsRef = useRef(effectsEnabled);
  const onScoreChangeRef = useRef(onScoreChange);
  const onGameOverRef = useRef(onGameOver);

  pausedRef.current = paused;
  effectsRef.current = effectsEnabled;
  onScoreChangeRef.current = onScoreChange;
  onGameOverRef.current = onGameOver;

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
      gameOver: false,
    };
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
      const direction = DIRECTIONS[key];
      if (!direction) return;
      event.preventDefault();
      setDirection(direction);
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
      const nextHead = { x: head.x + runtime.direction.x, y: head.y + runtime.direction.y };
      const eating = nextHead.x === runtime.food?.x && nextHead.y === runtime.food?.y;
      const collisionBody = eating ? runtime.snake : runtime.snake.slice(0, -1);
      const hitWall = nextHead.x < 0 || nextHead.x >= COLUMNS || nextHead.y < 0 || nextHead.y >= ROWS;
      const hitSelf = collisionBody.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);

      if (hitWall || hitSelf) {
        finish();
        return;
      }

      runtime.snake.unshift(nextHead);
      if (eating) {
        runtime.score += 10;
        runtime.food = createFood(runtime.snake);
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

      runtime.snake.forEach((segment, index) => {
        const inset = Math.max(2, cellSize * 0.09);
        const x = offsetX + segment.x * cellSize + inset;
        const y = offsetY + segment.y * cellSize + inset;
        const size = cellSize - inset * 2;
        context.beginPath();
        context.roundRect(x, y, size, size, Math.max(2, cellSize * 0.2));
        context.fillStyle = index === 0 ? "#70ffe1" : "#20cfb6";
        context.shadowColor = "#00f5d4";
        context.shadowBlur = effectsRef.current ? (index === 0 ? 13 : 5) : 0;
        context.fill();
      });
      context.shadowBlur = 0;

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
      const stepInterval = Math.max(75, 145 - Math.floor(runtime.score / 50) * 5);
      while (runtime.started && runtime.moveAccumulator >= stepInterval && !runtime.gameOver) {
        move();
        runtime.moveAccumulator -= stepInterval;
      }
      render(now);
      if (!runtime.gameOver) animationFrameRef.current = window.requestAnimationFrame(animate);
    }

    runtime.food = createFood(runtime.snake);
    loopRef.current = () => {
      runtime.lastFrameAt = 0;
      runtime.moveAccumulator = 0;
      animationFrameRef.current = window.requestAnimationFrame(animate);
    };
    resize();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", resize);
      observer.disconnect();
      runtimeRef.current = null;
      loopRef.current = null;
    };
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
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

  return (
    <div className="snake-game">
      <canvas ref={canvasRef} className="snake-canvas" aria-label="Permainan Snake. Gunakan tombol panah atau WASD untuk menggerakkan ular." />
      <div className="snake-touch-controls" aria-label="Kontrol Snake">
        <button type="button" onClick={() => steer("up")} aria-label="Gerak ke atas">▲</button>
        <div>
          <button type="button" onClick={() => steer("left")} aria-label="Gerak ke kiri">◀</button>
          <button type="button" onClick={() => steer("down")} aria-label="Gerak ke bawah">▼</button>
          <button type="button" onClick={() => steer("right")} aria-label="Gerak ke kanan">▶</button>
        </div>
      </div>
    </div>
  );
}
