"use client";

import Link from "next/link";
import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type HalideTopoHeroProps = {
  className?: string;
};

const layerImages = [
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1600",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=1600",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&q=80&w=1600",
];

export function HalideTopoHero({ className }: HalideTopoHeroProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const handleMouseMove = (e: MouseEvent) => {
      if (reducedMotion) return;
      const x = (window.innerWidth / 2 - e.pageX) / 25;
      const y = (window.innerHeight / 2 - e.pageY) / 25;

      canvas.style.transform = `rotateX(${55 + y / 2}deg) rotateZ(${-25 + x / 2}deg)`;

      layersRef.current.forEach((layer, index) => {
        if (!layer) return;
        const depth = (index + 1) * 15;
        const moveX = x * (index + 1) * 0.2;
        const moveY = y * (index + 1) * 0.2;
        layer.style.transform = `translateZ(${depth}px) translate(${moveX}px, ${moveY}px)`;
      });
    };

    canvas.style.opacity = "0";
    canvas.style.transform = "rotateX(90deg) rotateZ(0deg) scale(0.8)";

    const timeout = window.setTimeout(() => {
      canvas.style.transition = "all 2.5s cubic-bezier(0.16, 1, 0.3, 1)";
      canvas.style.opacity = "1";
      canvas.style.transform = reducedMotion ? "none" : "rotateX(55deg) rotateZ(-25deg) scale(1)";
    }, 250);

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <section
      className={cn(
        "smx-dark-frame relative isolate px-6 py-10 text-[#f4f3ec] md:px-10 md:py-14",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,60,0,0.24),transparent_35%),radial-gradient(circle_at_80%_5%,rgba(255,255,255,0.12),transparent_40%)]" />
        <div className="absolute inset-0 [background:repeating-linear-gradient(90deg,rgba(255,255,255,0.03)_0_1px,transparent_1px_52px)]" />
      </div>

      <div className="relative z-10 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="space-y-5">
          <p className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.26em] text-white/70">
            Halide Core
          </p>
          <h1 className="text-4xl font-semibold leading-[0.9] tracking-[-0.03em] md:text-7xl">
            SILVER
            <br />
            SULPHIDE
          </h1>
          <p className="max-w-xl text-sm text-white/70 md:text-base">
            Surface tension and topographical light. A cinematic control plane for high-resolution audio tooling.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/tools/stem-isolation"
              className="inline-flex items-center rounded-md bg-[var(--card)] px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--foreground)] transition hover:-translate-y-1 hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]"
            >
              Explore Depth
            </Link>
            <span className="inline-flex items-center text-xs font-mono uppercase tracking-[0.14em] text-white/70">
              Archive 2026
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="smx-chip border-white/20 bg-white/5 text-white/70">Realtime Status</span>
            <span className="smx-chip border-white/20 bg-white/5 text-white/70">Single Upload Workflow</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[620px] [perspective:2000px]">
          <div className="relative h-[320px] sm:h-[380px]">
            <div
              ref={canvasRef}
              className="absolute inset-0 mx-auto h-full w-full max-w-[580px] [transform-style:preserve-3d]"
            >
              {layerImages.map((url, index) => (
                <div
                  key={url}
                  ref={(el) => {
                    layersRef.current[index] = el;
                  }}
                  className="absolute inset-0 rounded-3xl border border-white/10 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${url})`,
                    filter:
                      index === 0
                        ? "grayscale(1) contrast(1.25) brightness(0.5)"
                        : index === 1
                          ? "grayscale(1) contrast(1.1) brightness(0.75)"
                          : "grayscale(1) contrast(1.3) brightness(0.85)",
                    opacity: index === 0 ? 1 : index === 1 ? 0.62 : 0.45,
                    mixBlendMode: index === 0 ? "normal" : index === 1 ? "screen" : "overlay",
                  }}
                />
              ))}

              <div className="pointer-events-none absolute -inset-10 rounded-full bg-[repeating-radial-gradient(circle_at_50%_50%,transparent_0,transparent_38px,rgba(255,255,255,0.06)_39px,transparent_41px)] [transform:translateZ(120px)]" />
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 h-14 w-px -translate-x-1/2 bg-gradient-to-b from-[#e0e0e0] to-transparent" />
    </section>
  );
}
