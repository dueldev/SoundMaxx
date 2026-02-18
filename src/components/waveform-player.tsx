"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

type WaveformPlayerProps = {
  src: string;
};

export function WaveformPlayer({ src }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const wave = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#9bd8ff",
      progressColor: "#0d6db8",
      cursorColor: "#083866",
      height: 84,
      barWidth: 2,
      barGap: 1,
      normalize: true,
      dragToSeek: true,
      mediaControls: false,
    });

    waveRef.current = wave;
    wave.load(src);

    const onFinish = () => setIsPlaying(false);
    wave.on("finish", onFinish);

    return () => {
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
    <div className="rounded-2xl border border-[#c6e0f1] bg-[#f7fcff] p-4 shadow-[0_18px_50px_-36px_rgba(16,81,124,0.9)]">
      <div ref={containerRef} aria-label="Waveform preview" className="mb-3" />
      <button
        type="button"
        onClick={togglePlayback}
        className="rounded-full bg-[#0f628f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b5377] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f628f]"
      >
        {isPlaying ? "Pause Preview" : "Play Preview"}
      </button>
    </div>
  );
}
