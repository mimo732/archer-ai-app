"use client";

import { useEffect, useRef } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

interface ParticleOrbProps {
  state: OrbState;
  size?: number;
  onClick?: () => void;
}

interface Particle {
  /** spherical coords */
  theta: number; // 0..2pi  around Y
  phi: number; // 0..pi   from pole
  radius: number; // 0.75..1 of sphere
  color: string;
  baseSize: number;
  phase: number;
  speed: number;
  jitter: number;
}

const CYAN = [64, 224, 208];
const CYAN2 = [34, 211, 238];
const GOLD = [255, 213, 74];
const GREEN = [74, 222, 128];

function pickColor(): string {
  const r = Math.random();
  if (r < 0.55) return `rgb(${CYAN.join(",")})`;
  if (r < 0.75) return `rgb(${CYAN2.join(",")})`;
  if (r < 0.95) return `rgb(${GOLD.join(",")})`;
  return `rgb(${GREEN.join(",")})`;
}

export default function ParticleOrb({ state, size = 300, onClick }: ParticleOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<OrbState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // build particle field
    const COUNT = 750;
    const particles: Particle[] = [];
    for (let i = 0; i < COUNT; i++) {
      particles.push({
        theta: Math.random() * Math.PI * 2,
        phi: Math.acos(2 * Math.random() - 1),
        radius: 0.72 + Math.random() * 0.28,
        color: pickColor(),
        baseSize: 0.7 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.8,
        jitter: 0.2 + Math.random() * 0.8,
      });
    }

    let raf = 0;
    let t = 0;
    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.36;

    // smoothed intensity per state
    let intensity = 0.35;
    let rotSpeed = 0.004;

    const draw = () => {
      t += 1;
      const s = stateRef.current;

      const targetIntensity =
        s === "idle" ? 0.35 : s === "listening" ? 0.65 : s === "thinking" ? 0.9 : 1;
      const targetRot =
        s === "idle" ? 0.0045 : s === "listening" ? 0.008 : s === "thinking" ? 0.02 : 0.012;
      intensity += (targetIntensity - intensity) * 0.04;
      rotSpeed += (targetRot - rotSpeed) * 0.05;

      ctx.clearRect(0, 0, size, size);

      // ---- center nebula glow ----
      const glowR = R * (1.1 + Math.sin(t * 0.02) * 0.05 * intensity);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grad.addColorStop(0, `rgba(45, 212, 191, ${0.16 + intensity * 0.1})`);
      grad.addColorStop(0.45, `rgba(20, 120, 110, ${0.08 + intensity * 0.06})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // ---- orbital rings ----
      ctx.save();
      ctx.translate(cx, cy);
      const rings = 2;
      for (let i = 0; i < rings; i++) {
        const tilt = 0.45 + i * 0.5;
        const rr = R * (1.02 + i * 0.06);
        ctx.save();
        ctx.rotate((i === 0 ? 0.4 : -0.35) + t * 0.001 * (i === 0 ? 1 : -1.4));
        ctx.strokeStyle = `rgba(94, 234, 212, ${0.14 + intensity * 0.08})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, rr, rr * Math.abs(Math.cos(tilt)) + 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // ---- outer boundary ring ----
      const ringPulse = 0.5 + Math.sin(t * 0.03) * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.44, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(45, 212, 191, ${0.35 + intensity * 0.3 + ringPulse * 0.1})`;
      ctx.lineWidth = 1.4;
      ctx.shadowColor = "rgba(45, 212, 191, 0.8)";
      ctx.shadowBlur = 10 + intensity * 14;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ---- rotating particles on sphere ----
      const rotY = t * rotSpeed;
      const speakingWave = s === "speaking" ? 1 : 0;
      const listeningAgitation = s === "listening" ? 0.5 : 0;

      for (const p of particles) {
        // spherical -> xyz
        let x = p.radius * Math.sin(p.phi) * Math.cos(p.theta + rotY * p.speed);
        const y0 = p.radius * Math.cos(p.phi);
        let z = p.radius * Math.sin(p.phi) * Math.sin(p.theta + rotY * p.speed);

        // breathing + state vibration
        const wob =
          Math.sin(t * 0.05 * p.speed + p.phase) * 0.02 * (0.3 + intensity) +
          Math.sin(t * 0.5 + p.phase) * 0.012 * speakingWave * p.jitter +
          Math.sin(t * 0.35 + p.phase * 2) * 0.02 * listeningAgitation * p.jitter;

        x += wob;
        const y = y0 + wob * 0.6;
        z += wob * 0.4;

        const px = cx + x * R;
        const py = cy + y * R;

        // depth: front particles brighter & bigger
        const depth = (z + 1) / 2; // 0 back .. 1 front
        const twinkle = 0.6 + 0.4 * Math.sin(t * 0.08 * p.speed + p.phase);
        const alpha = (0.15 + depth * 0.75) * twinkle * (0.55 + intensity * 0.45);
        const r = p.baseSize * (0.55 + depth * 0.8) * (1 + speakingWave * 0.35 * Math.abs(Math.sin(t * 0.4 + p.phase)));

        ctx.globalAlpha = Math.min(alpha, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ---- horizon dots ring (like the video's dotted arc) ----
      ctx.fillStyle = `rgba(250, 204, 21, ${0.25 + intensity * 0.2})`;
      const dots = 26;
      for (let i = 0; i < dots; i++) {
        const a = (i / dots) * Math.PI * 2 + t * 0.002;
        const rx = Math.cos(a) * R * 1.12;
        const ry = Math.sin(a) * R * 0.32;
        ctx.beginPath();
        ctx.arc(cx + rx, cy + ry + R * 0.28, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <div
      className="relative select-none cursor-pointer"
      style={{ width: size, height: size }}
      onClick={onClick}
      role="button"
      aria-label="AI core — tap to talk"
      data-wire-target
    >
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
    </div>
  );
}
