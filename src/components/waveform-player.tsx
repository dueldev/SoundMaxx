"use client";

import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import type WaveSurfer from "wavesurfer.js";

type WaveformPlayerProps = {
  src: string;
};

export function WaveformPlayer({ src }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let wave: WaveSurfer | null = null;
    const onFinish = () => setIsPlaying(false);

    setIsPlaying(false);

    const initWaveform = async () => {
      if (!containerRef.current) return;
      const { default: WaveSurfer } = await import("wavesurfer.js");
      if (cancelled || !containerRef.current) return;

      wave = WaveSurfer.create({
        container: containerRef.current,
        waveColor: "#c0b8a8",
        progressColor: "#ff3b00",
        cursorColor: "#0c0c0a",
        height: 72,
        barWidth: 2,
        barGap: 1,
        normalize: true,
        dragToSeek: true,
        mediaControls: false,
      });

      waveRef.current = wave;
      wave.load(src);
      wave.on("finish", onFinish);
    };

    void initWaveform();

    return () => {
      cancelled = true;
      if (!wave) return;
      wave.un("finish", onFinish);
      wave.destroy();
      waveRef.current = null;
    };
  }, [src]);

  const togglePlayback = () => {
    if (!waveRef.current) return;
    waveRef.current.playPause();
    setIsPlaying((prev) => !prev);
  };

  return (
    <div
      className="border p-3"
      style={{ borderColor: "var(--muted)", background: "var(--card)" }}
    >
      <div ref={containerRef} aria-label="Waveform preview" className="mb-3" />
      <button
        type="button"
        onClick={togglePlayback}
        className="brutal-button-ghost px-3 text-[11px]"
      >
        {isPlaying ? <PauseIcon className="size-3.5" /> : <PlayIcon className="size-3.5" />}
        {isPlaying ? "Pause" : "Play Preview"}
      </button>
    </div>
  );
}
