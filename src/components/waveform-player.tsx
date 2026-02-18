"use client";

import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
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
      waveColor: "#7f6a63",
      progressColor: "#ff5600",
      cursorColor: "#000ce1",
      height: 72,
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
    <div className="smx-subframe p-3">
      <div ref={containerRef} aria-label="Waveform preview" className="mb-3" />
      <button
        type="button"
        onClick={togglePlayback}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary-foreground transition hover:brightness-110"
      >
        {isPlaying ? <PauseIcon className="size-3.5" /> : <PlayIcon className="size-3.5" />}
        {isPlaying ? "Pause" : "Play Preview"}
      </button>
    </div>
  );
}
