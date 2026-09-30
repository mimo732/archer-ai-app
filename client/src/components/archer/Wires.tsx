"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface WiresProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  colors?: string[];
}

const DEFAULT_COLORS = ["#22d3ee", "#fb923c", "#e2e8f0", "#4ade80"];

/**
 * Draws glowing "circuit wires" from each [data-wire-node] element
 * to the [data-wire-target] element (the orb), recalculated on resize.
 */
export default function Wires({ containerRef, colors = DEFAULT_COLORS }: WiresProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const rafRef = useRef(0);

  const compute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-wire-node]"));
    const target = container.querySelector<HTMLElement>("[data-wire-target]");
    if (!target || nodes.length === 0) return;

    const tRect = target.getBoundingClientRect();
    const tcx = tRect.left - cRect.left + tRect.width / 2;
    const tcy = tRect.top - cRect.top + tRect.height / 2;
    const tR = tRect.width * 0.47;

    const next = nodes.map((node, i) => {
      const nRect = node.getBoundingClientRect();
      const sx = nRect.right - cRect.left - 6;
      const sy = nRect.top - cRect.top + nRect.height / 2;
      // bundle entry points on the orb's left rim
      const ty = tcy - 21 + i * 14;
      const tx = tcx - Math.sqrt(Math.max(tR * tR - (ty - tcy) * (ty - tcy), 0));
      const midX = (sx + tx) / 2;
      const sag = 10 + i * 4;
      return `M ${sx} ${sy} C ${midX} ${sy + sag}, ${midX} ${ty - sag * 0.4}, ${tx} ${ty}`;
    });

    setPaths(next);
  }, [containerRef]);

  useEffect(() => {
    // defer first computation to next frame to avoid sync setState in effect
    rafRef.current = requestAnimationFrame(() => {
      compute();
      setReady(true);
    });
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(compute);
    });
    ro.observe(container);
    Array.from(container.querySelectorAll("[data-wire-node], [data-wire-target]")).forEach((el) => ro.observe(el));
    window.addEventListener("resize", compute);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
      cancelAnimationFrame(rafRef.current);
    };
  }, [compute, containerRef]);

  return (
    <svg
      className="pointer-events-none absolute inset-0 w-full h-full"
      style={{ zIndex: 5, visibility: ready ? "visible" : "hidden" }}
      aria-hidden="true"
    >
      <defs>
        <filter id="wire-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {paths.map((d, i) => (
        <g key={i} style={{ filter: `drop-shadow(0 0 5px ${colors[i % colors.length]})` }}>
          <path d={d} fill="none" stroke={colors[i % colors.length]} strokeWidth={5} strokeOpacity={0.18} strokeLinecap="round" />
          <path d={d} fill="none" stroke={colors[i % colors.length]} strokeWidth={1.6} strokeOpacity={0.95} strokeLinecap="round" filter="url(#wire-glow)" />
        </g>
      ))}
    </svg>
  );
}
