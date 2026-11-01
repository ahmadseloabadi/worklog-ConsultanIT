import { useEffect, useRef, useState } from "react";

const palettes = {
  neon: ["#00f5d4", "#7b2cbf", "#f72585", "#4cc9f0", "#ff007f"],
  pastel: ["#ffb5a7", "#fcd5ce", "#f8edeb", "#f8ad9d", "#c9e4de"],
  fire: ["#ff4800", "#ff5400", "#ff6000", "#ff7b00", "#ff9100"],
  cyber: ["#8a2be2", "#00ffff", "#ff00ff", "#39ff14", "#ffff00"],
};

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const position = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + position * dx), point.y - (start.y + position * dy));
}

function makePolygonPath(context, size, sides, rotation = 0) {
  context.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + index * Math.PI * 2 / sides;
    const x = Math.cos(angle) * size;
    const y = Math.sin(angle) * size;
    if (!index) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

export default function SatisfyingArcade({
  mode,
  onScoreChange,
  interactionDisabled = false,
  effectsEnabled = true,
  soundEnabled = true,
  paused = false,
}) {
  const canvasRef = useRef(null);
  const paletteRef = useRef(palettes.neon);
  const mutedRef = useRef(!soundEnabled);
  const interactionDisabledRef = useRef(interactionDisabled);
  const effectsEnabledRef = useRef(effectsEnabled);
  const pausedRef = useRef(paused);
  const animationFrameRef = useRef(0);
  const animationLoopRef = useRef(null);
  const [paletteName, setPaletteName] = useState("neon");
  paletteRef.current = palettes[paletteName];
  mutedRef.current = !soundEnabled;
  interactionDisabledRef.current = interactionDisabled;
  effectsEnabledRef.current = effectsEnabled;
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    let width = 0;
    let height = 0;
    let spawnAt = 0;
    let score = 0;
    let previousPoint = null;
    let trail = [];
    let audioContext;
    let shakeTime = 0;
    let shakeIntensity = 0;
    let palette = paletteRef.current;
    const targets = [];
    const halves = [];
    const bubbles = [];
    const particles = [];
    const ripples = [];

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      palette = paletteRef.current;
      createBubbles();
    }

    function createBubbles() {
      bubbles.length = 0;
      if (mode !== "pop" || !width || !height) return;
      const spacing = Math.max(58, Math.min(78, Math.round(Math.min(width / 11, height / 7))));
      const columns = Math.max(1, Math.floor((width - spacing) / spacing));
      const rows = Math.max(1, Math.floor((height - spacing) / spacing));
      const startX = (width - (columns - 1) * spacing) / 2;
      const startY = (height - (rows - 1) * spacing) / 2;
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          bubbles.push({
            x: startX + column * spacing,
            y: startY + row * spacing,
            radius: Math.min(31, spacing * 0.4),
            color: palette[(row + column) % palette.length],
            scale: 1,
            targetScale: 1,
            popped: false,
            popAt: 0,
          });
        }
      }
    }

    function playSound(type, pitch = 1) {
      if (mutedRef.current) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContext ||= new AudioContext();
      if (audioContext.state === "suspended") void audioContext.resume();

      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const isSlice = type === "slice";
      const duration = isSlice ? 0.12 : 0.08;
      const base = isSlice ? [261.63, 293.66, 329.63, 392, 440, 523.25][Math.floor(Math.random() * 6)] : 180 + Math.random() * 220;
      oscillator.type = isSlice ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(base * (isSlice ? 1.5 : pitch), now);
      oscillator.frequency.exponentialRampToValueAtTime(base * (isSlice ? 0.5 : 2.5) * pitch, now + duration);
      gain.gain.setValueAtTime(isSlice ? 0.25 : 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(now + duration);

      if (type === "slice") {
        const bass = audioContext.createOscillator();
        const bassGain = audioContext.createGain();
        bass.type = "sine";
        bass.frequency.setValueAtTime(120, now);
        bass.frequency.exponentialRampToValueAtTime(34, now + 0.2);
        bassGain.gain.setValueAtTime(0.16, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        bass.connect(bassGain);
        bassGain.connect(audioContext.destination);
        bass.start();
        bass.stop(now + 0.2);
      }
    }

    function addScore(points) {
      score += points;
      onScoreChange(score);
    }

    function burst(x, y, color, count = 18, force = 8) {
      if (!effectsEnabledRef.current) return;
      const shapes = ["circle", "rect", "shard"];
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * force + 1.5;
        particles.push({
          x, y, color,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 5 + 3,
          alpha: 1,
          decay: Math.random() * 0.018 + 0.014,
          rotation: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.2,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          gravity: 0.14,
        });
      }
    }

    function createRipple(x, y, color, intensity = 1) {
      if (!effectsEnabledRef.current) return;
      ripples.push({ x, y, color, radius: 5, maxRadius: (70 + Math.random() * 40) * intensity, alpha: 1, lineWidth: 6 });
    }

    function sliceTarget(target, start, end) {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      for (const direction of [-1, 1]) {
        const impulse = Math.random() * 4 + 3;
        const perpendicular = angle + Math.PI / 2 * direction;
        halves.push({
          x: target.x,
          y: target.y,
          vx: target.vx * 0.5 + Math.cos(perpendicular) * impulse,
          vy: target.vy * 0.5 + Math.sin(perpendicular) * impulse,
          gravity: 0.35,
          size: target.size,
          sides: target.sides,
          color: target.color,
          rotation: angle,
          shapeRotation: target.rotation - angle,
          spin: direction * (Math.random() * 0.1 + 0.05),
          direction,
          alpha: 1,
        });
      }
      addScore(150);
      if (effectsEnabledRef.current) {
        shakeTime = 12;
        shakeIntensity = 8;
      }
      playSound("slice");
      createRipple(target.x, target.y, target.color);
      burst(target.x, target.y, target.color, 25, 12);
    }

    function popBubble(bubble) {
      if (bubble.popped) return;
      bubble.popped = true;
      bubble.popAt = performance.now();
      bubble.targetScale = 0.72;
      addScore(10);
      playSound("pop", 1 + bubble.y / Math.max(height, 1) * 0.5);
      createRipple(bubble.x, bubble.y, bubble.color, 0.72);
      burst(bubble.x, bubble.y, bubble.color, 12, 5);
      if (effectsEnabledRef.current) {
        shakeTime = 4;
        shakeIntensity = 1.8;
      }
    }

    function popAt(x, y) {
      const bubble = bubbles.find((item) =>
        !item.popped && Math.hypot(item.x - x, item.y - y) < item.radius
      );
      if (bubble) popBubble(bubble);
    }

    function handlePointerMove(event) {
      if (interactionDisabledRef.current || pausedRef.current) return;
      const bounds = canvas.getBoundingClientRect();
      const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      trail.push(point);
      if (trail.length > 8) trail.shift();

      if (mode === "pop") {
        popAt(point.x, point.y);
      } else if (mode === "slice" && previousPoint) {
        for (let index = targets.length - 1; index >= 0; index -= 1) {
          const target = targets[index];
          if (distanceToSegment(target, previousPoint, point) < target.size) {
            targets.splice(index, 1);
            sliceTarget(target, previousPoint, point);
          }
        }
      }
      previousPoint = point;
    }

    function handlePointerDown(event) {
      if (interactionDisabledRef.current || pausedRef.current) return;
      previousPoint = null;
      trail = [];
      canvas.setPointerCapture?.(event.pointerId);
      handlePointerMove(event);
    }

    function handlePointerUp() {
      previousPoint = null;
      window.setTimeout(() => { trail = []; }, 100);
    }

    function spawnTargets(now) {
      if (now < spawnAt) return;
      spawnAt = now + 570;
      const count = Math.random() < 0.4 ? 2 : 1;
      for (let index = 0; index < count; index += 1) {
        const margin = 80;
        targets.push({
          x: margin + Math.random() * Math.max(1, width - margin * 2),
          y: height + 60,
          vx: (Math.random() - 0.5) * 6,
          vy: -(13 + Math.random() * 4),
          gravity: 0.28,
          size: 35 + Math.random() * 25,
          rotation: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.08,
          sides: 3 + Math.floor(Math.random() * 3),
          color: palette[Math.floor(Math.random() * palette.length)],
        });
      }
    }

    function drawTarget(target) {
      context.save();
      context.translate(target.x, target.y);
      context.rotate(target.rotation);
      context.shadowColor = target.color;
      context.shadowBlur = effectsEnabledRef.current ? 20 : 0;
      context.fillStyle = target.color;
      context.strokeStyle = "#fff";
      context.lineWidth = 3;
      makePolygonPath(context, target.size, target.sides);
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(0, 0, target.size * 0.4, 0, Math.PI * 2);
      context.fillStyle = "rgba(255,255,255,.4)";
      context.fill();
      context.restore();
    }

    function drawHalf(piece) {
      context.save();
      context.globalAlpha = Math.max(0, piece.alpha);
      context.translate(piece.x, piece.y);
      context.rotate(piece.rotation);
      context.shadowColor = piece.color;
      context.shadowBlur = effectsEnabledRef.current ? 12 : 0;
      context.fillStyle = piece.color;
      const clipBounds = piece.size * 1.5;
      context.beginPath();
      if (piece.direction > 0) context.rect(-clipBounds, -clipBounds, clipBounds * 2, clipBounds);
      else context.rect(-clipBounds, 0, clipBounds * 2, clipBounds);
      context.clip();
      makePolygonPath(context, piece.size, piece.sides, piece.shapeRotation);
      context.fill();
      context.restore();
    }

    function drawBubble(bubble, now) {
      const elapsed = now - bubble.popAt;
      if (bubble.popped && elapsed > 1500) {
        bubble.popped = false;
        bubble.targetScale = 1;
      }
      bubble.scale += (bubble.targetScale - bubble.scale) * (bubble.popped ? 0.3 : 0.12);
      if (!bubble.popped && bubble.scale > 0.999) bubble.scale = 1;

      context.save();
      context.translate(bubble.x, bubble.y);
      context.scale(bubble.scale, bubble.scale);
      const radius = bubble.radius;
      if (!bubble.popped) {
        const gradient = context.createRadialGradient(-radius * 0.3, -radius * 0.3, radius * 0.1, 0, 0, radius);
        gradient.addColorStop(0, "#fff");
        gradient.addColorStop(0.3, bubble.color);
        gradient.addColorStop(1, "#08090e");
        context.fillStyle = gradient;
        context.shadowColor = bubble.color;
        context.shadowBlur = effectsEnabledRef.current ? 16 : 0;
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(-radius * 0.35, -radius * 0.35, radius * 0.25, 0, Math.PI * 2);
        context.fillStyle = "rgba(255,255,255,.65)";
        context.fill();
      } else {
        const progress = Math.min(elapsed / 360, 1);
        context.fillStyle = "rgba(0,0,0,.4)";
        context.beginPath();
        context.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = bubble.color;
        context.lineWidth = 3;
        context.shadowColor = bubble.color;
        context.shadowBlur = effectsEnabledRef.current ? 12 : 0;
        context.beginPath();
        context.arc(0, 0, radius * (0.9 - progress * 0.2), 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = "rgba(0,0,0,.65)";
        context.lineWidth = 4;
        context.shadowBlur = 0;
        context.beginPath();
        context.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
        context.stroke();
      }
      context.restore();
    }

    function animate(now) {
      if (pausedRef.current) return;
      if (palette !== paletteRef.current) {
        palette = paletteRef.current;
        bubbles.forEach((bubble, index) => {
          bubble.color = palette[index % palette.length];
        });
      }
      context.save();
      if (shakeTime > 0) {
        context.translate((Math.random() - 0.5) * shakeIntensity, (Math.random() - 0.5) * shakeIntensity);
        shakeTime -= 1;
      }
      context.fillStyle = "rgba(11, 12, 16, 0.35)";
      context.fillRect(-20, -20, width + 40, height + 40);

      if (mode === "slice") {
        spawnTargets(now);
        for (let index = targets.length - 1; index >= 0; index -= 1) {
          const target = targets[index];
          target.x += target.vx;
          target.y += target.vy;
          target.vy += target.gravity;
          target.rotation += target.spin;
          drawTarget(target);
          if (target.y > height + 100) targets.splice(index, 1);
        }
        for (let index = halves.length - 1; index >= 0; index -= 1) {
          const piece = halves[index];
          piece.x += piece.vx;
          piece.y += piece.vy;
          piece.vy += piece.gravity;
          piece.rotation += piece.spin;
          piece.alpha -= 0.012;
          drawHalf(piece);
          if (piece.y > height + 100 || piece.alpha <= 0) halves.splice(index, 1);
        }
      } else {
        bubbles.forEach((bubble) => drawBubble(bubble, now));
      }

      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index];
        ripple.radius += (ripple.maxRadius - ripple.radius) * 0.15;
        ripple.alpha -= 0.035;
        ripple.lineWidth *= 0.94;
        context.globalAlpha = Math.max(0, ripple.alpha);
        context.beginPath();
        context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
        context.strokeStyle = ripple.color;
        context.lineWidth = ripple.lineWidth;
        context.shadowColor = ripple.color;
        context.shadowBlur = effectsEnabledRef.current ? 15 : 0;
        context.stroke();
        if (ripple.alpha <= 0) ripples.splice(index, 1);
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += particle.gravity;
        particle.vx *= 0.98;
        particle.vy *= 0.98;
        particle.rotation += particle.spin;
        particle.alpha -= particle.decay;
        context.save();
        context.globalAlpha = Math.max(0, particle.alpha);
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.fillStyle = particle.color;
        context.shadowColor = particle.color;
        context.shadowBlur = effectsEnabledRef.current ? 10 : 0;
        if (particle.shape === "circle") {
          context.beginPath();
          context.arc(0, 0, particle.size, 0, Math.PI * 2);
          context.fill();
        } else if (particle.shape === "rect") {
          context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
        } else {
          context.beginPath();
          context.moveTo(0, -particle.size);
          context.lineTo(particle.size / 2, particle.size);
          context.lineTo(-particle.size / 2, particle.size);
          context.closePath();
          context.fill();
        }
        context.restore();
        if (particle.alpha <= 0) particles.splice(index, 1);
      }
      context.restore();

      if (trail.length > 1) {
        context.beginPath();
        context.moveTo(trail[0].x, trail[0].y);
        trail.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        context.strokeStyle = "#fff";
        context.lineWidth = 6;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.shadowColor = "#00f5d4";
        context.shadowBlur = effectsEnabledRef.current ? 15 : 0;
        context.stroke();
        context.shadowBlur = 0;
      }
      animationFrameRef.current = window.requestAnimationFrame(animate);
    }

    onScoreChange(0);
    resize();
    animationLoopRef.current = () => animate(performance.now());
    if (!pausedRef.current) animationFrameRef.current = window.requestAnimationFrame(animate);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
      animationLoopRef.current = null;
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      if (audioContext) void audioContext.close();
    };
  }, [mode, onScoreChange]);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    } else if (animationLoopRef.current && !animationFrameRef.current) {
      animationLoopRef.current();
    }
  }, [paused]);

  return (
    <div className="arcade-frame">
      <div className="arcade-toolbar">
        <div className="arcade-palettes" aria-label="Pilih warna game">
          {Object.keys(palettes).map((name) => (
            <button
              key={name}
              type="button"
              className={`arcade-palette${paletteName === name ? " is-active" : ""}`}
              onClick={() => setPaletteName(name)}
              aria-label={`Palet ${name}`}
              title={name}
            >
              <span style={{ background: `linear-gradient(135deg, ${palettes[name][0]}, ${palettes[name][2]})` }} />
            </button>
          ))}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className={`arcade-canvas${interactionDisabled ? " is-disabled" : ""}`}
        aria-label={mode === "slice" ? "Game Slice & Shred, geser untuk memotong bentuk" : "Game Bubble Wrap, tekan atau geser untuk memecahkan gelembung"}
      />
      <p className="arcade-hint">
        {mode === "slice"
          ? "Gerakkan mouse melintasi bentuk tanpa klik, atau geser jari di layar."
          : "Arahkan mouse ke gelembung tanpa klik, atau sentuh dan geser di layar."}
      </p>
    </div>
  );
}
