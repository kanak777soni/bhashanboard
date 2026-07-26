"use client";

import { useEffect, useRef } from "react";

/**
 * Guilloché engraving — the pattern on banknotes and share certificates.
 * Drawn live from hypotrochoid curves rather than shipped as SVG path
 * data or an image, so it rescales with the container and recolours with
 * the theme. This is the single element doing most of the work of making
 * the site look like nothing else (docs/07-design-language.md §7.5).
 */
export default function Guilloche({ variant }: { variant: "band" | "frame" }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const rosette = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      R: number,
      r: number,
      d: number,
      turns: number,
      steps: number
    ) => {
      const k = (R - r) / r;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2 * turns;
        const x = cx + (R - r) * Math.cos(t) + d * Math.cos(k * t);
        const y = cy + (R - r) * Math.sin(t) - d * Math.sin(k * t);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    };

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 0.45;
      ctx.strokeStyle =
        getComputedStyle(document.documentElement).getPropertyValue("--foil").trim() || "#A9853A";

      if (variant === "band") {
        ctx.globalAlpha = 0.42;
        const step = 108;
        for (let x = -20; x < w + 60; x += step) {
          rosette(ctx, x, h * 0.5, 46, 9, 21, 9, 620);
          rosette(ctx, x + step / 2, h * 0.5, 28.5, 7, 15, 7, 460);
        }
      } else {
        ctx.globalAlpha = 0.5;
        const step = 74;
        for (let x = 0; x <= w; x += step) {
          rosette(ctx, x, 14, 30, 7, 14, 7, 460);
          rosette(ctx, x, h - 14, 30, 7, 14, 7, 460);
        }
        for (let y = 0; y <= h; y += step) {
          rosette(ctx, 14, y, 30, 7, 14, 7, 460);
          rosette(ctx, w - 14, y, 30, 7, 14, 7, 460);
        }
        ctx.globalAlpha = 0.16;
        rosette(ctx, w / 2, h / 2, Math.min(w, h) * 0.34, 11, 62, 11, 2200);
      }
    };

    draw();

    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(draw, 160);
    };
    window.addEventListener("resize", onResize);

    // Redraw when the theme flips, since --foil changes.
    const observer = new MutationObserver(draw);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      window.removeEventListener("resize", onResize);
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [variant]);

  return <canvas ref={ref} className="guilloche" style={{ width: "100%", height: "100%" }} aria-hidden="true" />;
}
