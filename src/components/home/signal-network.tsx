"use client";

import { useEffect, useRef, type CSSProperties } from "react";

type SignalNode = Readonly<{
  x: number;
  y: number;
  radius: number;
  phase: number;
  driftX: number;
  driftY: number;
  depth: number;
  primary: boolean;
}>;

type SignalLink = Readonly<{
  from: number;
  to: number;
  primary: boolean;
}>;

type Point = Readonly<{ x: number; y: number }>;

type Palette = Readonly<{
  lines: readonly [string, string, string];
  primaryLine: string;
  nodes: readonly [string, string, string];
  glow: readonly [string, string];
  wash: readonly [string, string];
}>;

type SignalNetworkProps = Readonly<{
  className?: string;
  style?: CSSProperties;
}>;

const DARK_PALETTE: Palette = {
  lines: ["rgba(79, 125, 255, 0.22)", "rgba(63, 226, 205, 0.18)", "rgba(145, 93, 255, 0.18)"],
  primaryLine: "rgba(119, 158, 255, 0.48)",
  nodes: ["rgba(126, 161, 255, 0.86)", "rgba(82, 235, 216, 0.82)", "rgba(166, 118, 255, 0.82)"],
  glow: ["rgba(55, 112, 255, 0.20)", "rgba(90, 238, 218, 0.14)"],
  wash: ["rgba(28, 74, 196, 0.12)", "rgba(100, 53, 188, 0.08)"],
};

const LIGHT_PALETTE: Palette = {
  lines: ["rgba(28, 76, 202, 0.20)", "rgba(0, 135, 143, 0.16)", "rgba(99, 55, 190, 0.15)"],
  primaryLine: "rgba(39, 91, 222, 0.42)",
  nodes: ["rgba(30, 86, 225, 0.78)", "rgba(0, 145, 151, 0.72)", "rgba(112, 62, 198, 0.72)"],
  glow: ["rgba(57, 111, 240, 0.12)", "rgba(18, 174, 169, 0.09)"],
  wash: ["rgba(50, 100, 222, 0.07)", "rgba(124, 78, 218, 0.05)"],
};

const W_ANCHORS: readonly Point[] = [
  { x: 0.08, y: 0.24 },
  { x: 0.28, y: 0.74 },
  { x: 0.5, y: 0.38 },
  { x: 0.72, y: 0.74 },
  { x: 0.92, y: 0.22 },
];

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function makeGraph() {
  const random = mulberry32(0x57495345);
  const nodes: SignalNode[] = [];

  for (let segment = 0; segment < W_ANCHORS.length - 1; segment += 1) {
    const from = W_ANCHORS[segment];
    const to = W_ANCHORS[segment + 1];
    const pointsInSegment = 7;

    for (let step = 0; step < pointsInSegment; step += 1) {
      if (segment > 0 && step === 0) continue;
      const progress = step / (pointsInSegment - 1);
      const isAnchor = step === 0 || step === pointsInSegment - 1;
      const jitter = isAnchor ? 0 : (random() - 0.5) * 0.026;

      nodes.push({
        x: from.x + (to.x - from.x) * progress + jitter,
        y: from.y + (to.y - from.y) * progress + jitter * 0.55,
        radius: isAnchor ? 2.25 : 1.2 + random() * 0.85,
        phase: random() * Math.PI * 2,
        driftX: 0.002 + random() * 0.004,
        driftY: 0.002 + random() * 0.005,
        depth: 0.45 + random() * 0.7,
        primary: true,
      });
    }
  }

  const primaryCount = nodes.length;
  for (let index = 0; index < 28; index += 1) {
    const source = nodes[Math.floor(random() * primaryCount)];
    const angle = random() * Math.PI * 2;
    const distance = 0.045 + random() * 0.15;

    nodes.push({
      x: Math.max(0.025, Math.min(0.975, source.x + Math.cos(angle) * distance)),
      y: Math.max(0.07, Math.min(0.93, source.y + Math.sin(angle) * distance)),
      radius: 0.65 + random() * 1.05,
      phase: random() * Math.PI * 2,
      driftX: 0.002 + random() * 0.006,
      driftY: 0.002 + random() * 0.007,
      depth: 0.25 + random() * 0.8,
      primary: false,
    });
  }

  const links: SignalLink[] = [];
  for (let index = 0; index < primaryCount - 1; index += 1) {
    links.push({ from: index, to: index + 1, primary: true });
  }

  for (let index = primaryCount; index < nodes.length; index += 1) {
    const nearest = nodes
      .slice(0, index)
      .map((node, target) => ({
        target,
        distance: Math.hypot(nodes[index].x - node.x, nodes[index].y - node.y),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, index % 4 === 0 ? 2 : 1);

    for (const neighbor of nearest) {
      if (neighbor.distance < 0.2) {
        links.push({ from: index, to: neighbor.target, primary: false });
      }
    }
  }

  return { nodes, links, primaryCount } as const;
}

const GRAPH = makeGraph();

function resolvePalette() {
  return document.documentElement.dataset.theme === "dark"
    ? DARK_PALETTE
    : LIGHT_PALETTE;
}

export function SignalNetwork({ className, style }: SignalNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    let width = 1;
    let height = 1;
    let animationFrame = 0;
    let lastFrame = -Infinity;
    let pageVisible = !document.hidden;
    let inViewport = true;
    let palette = resolvePalette();
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = motionQuery.matches;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const pointAt = (node: SignalNode, time: number): Point => {
      const motionTime = reduceMotion ? 0 : time;
      const driftX = Math.sin(motionTime * 0.00018 + node.phase) * node.driftX;
      const driftY = Math.cos(motionTime * 0.00015 + node.phase * 1.17) * node.driftY;
      const parallaxX = reduceMotion ? 0 : pointer.x * node.depth * 0.007;
      const parallaxY = reduceMotion ? 0 : pointer.y * node.depth * 0.009;

      return {
        x: (node.x + driftX + parallaxX) * width,
        y: (node.y + driftY + parallaxY) * height,
      };
    };

    const drawWash = () => {
      const first = context.createRadialGradient(
        width * 0.25,
        height * 0.58,
        0,
        width * 0.25,
        height * 0.58,
        Math.max(width, height) * 0.55,
      );
      first.addColorStop(0, palette.wash[0]);
      first.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = first;
      context.fillRect(0, 0, width, height);

      const second = context.createRadialGradient(
        width * 0.78,
        height * 0.32,
        0,
        width * 0.78,
        height * 0.32,
        Math.max(width, height) * 0.48,
      );
      second.addColorStop(0, palette.wash[1]);
      second.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = second;
      context.fillRect(0, 0, width, height);
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      drawWash();

      const points = GRAPH.nodes.map((node) => pointAt(node, time));

      for (let index = 0; index < GRAPH.links.length; index += 1) {
        const link = GRAPH.links[index];
        const from = points[link.from];
        const to = points[link.to];
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.lineWidth = link.primary ? 1.15 : 0.7;
        context.strokeStyle = link.primary
          ? palette.primaryLine
          : palette.lines[index % palette.lines.length];
        context.stroke();
      }

      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        const node = GRAPH.nodes[index];
        const pulse = reduceMotion
          ? 0.82
          : 0.68 + Math.sin(time * 0.0012 + node.phase) * 0.2;

        if (node.primary && index % 4 === 0) {
          const glow = context.createRadialGradient(
            point.x,
            point.y,
            0,
            point.x,
            point.y,
            node.radius * 7,
          );
          glow.addColorStop(0, palette.glow[index % palette.glow.length]);
          glow.addColorStop(1, "rgba(0, 0, 0, 0)");
          context.fillStyle = glow;
          context.beginPath();
          context.arc(point.x, point.y, node.radius * 7, 0, Math.PI * 2);
          context.fill();
        }

        context.fillStyle = palette.nodes[index % palette.nodes.length];
        context.globalAlpha = pulse;
        context.beginPath();
        context.arc(point.x, point.y, node.radius, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;

      if (!reduceMotion) {
        for (let pulseIndex = 0; pulseIndex < 4; pulseIndex += 1) {
          const pathProgress = (time * 0.000075 + pulseIndex / 4) % 1;
          const scaled = pathProgress * (GRAPH.primaryCount - 1);
          const linkIndex = Math.min(Math.floor(scaled), GRAPH.primaryCount - 2);
          const progress = scaled - linkIndex;
          const from = points[linkIndex];
          const to = points[linkIndex + 1];
          const x = from.x + (to.x - from.x) * progress;
          const y = from.y + (to.y - from.y) * progress;

          context.save();
          context.shadowBlur = 12;
          context.shadowColor = palette.nodes[pulseIndex % palette.nodes.length];
          context.fillStyle = palette.nodes[pulseIndex % palette.nodes.length];
          context.beginPath();
          context.arc(x, y, 2.1, 0, Math.PI * 2);
          context.fill();
          context.restore();
        }
      }
    };

    const shouldAnimate = () => pageVisible && inViewport && !reduceMotion;

    const frame = (time: number) => {
      if (!shouldAnimate()) {
        animationFrame = 0;
        return;
      }

      animationFrame = window.requestAnimationFrame(frame);
      if (time - lastFrame < 1000 / 30) return;
      lastFrame = time;
      pointer.x += (pointer.targetX - pointer.x) * 0.07;
      pointer.y += (pointer.targetY - pointer.y) * 0.07;
      draw(time);
    };

    const start = () => {
      if (shouldAnimate() && animationFrame === 0) {
        lastFrame = -Infinity;
        animationFrame = window.requestAnimationFrame(frame);
      } else if (!shouldAnimate()) {
        draw(0);
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const density = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(width * density));
      canvas.height = Math.max(1, Math.round(height * density));
      context.setTransform(density, 0, 0, density, 0, 0);
      draw(0);
      start();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (reduceMotion || !inViewport) return;
      const rect = canvas.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      pointer.targetX = inside
        ? Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2))
        : 0;
      pointer.targetY = inside
        ? Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2))
        : 0;
    };

    const handleVisibility = () => {
      pageVisible = !document.hidden;
      if (!pageVisible && animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      start();
    };

    const handleMotionPreference = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches;
      pointer.x = 0;
      pointer.y = 0;
      pointer.targetX = 0;
      pointer.targetY = 0;
      if (reduceMotion && animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      draw(0);
      start();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      if (!inViewport && animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      start();
    });
    intersectionObserver.observe(canvas);

    const themeObserver = new MutationObserver(() => {
      palette = resolvePalette();
      draw(reduceMotion ? 0 : performance.now());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    motionQuery.addEventListener("change", handleMotionPreference);
    resize();

    return () => {
      if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pointermove", handlePointerMove);
      motionQuery.removeEventListener("change", handleMotionPreference);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      data-signal-network=""
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}
