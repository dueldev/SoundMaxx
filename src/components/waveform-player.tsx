"use client";

import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import type WaveSurfer from "wavesurfer.js";
import { cn } from "@/lib/utils";

type WaveformPlayerProps = {
  src: string;
  group?: string;
  className?: string;
  waveformClassName?: string;
  buttonClassName?: string;
  buttonLabelPlay?: string;
  buttonLabelPause?: string;
  height?: number;
};

type WaveformPlayEvent = {
  group: string;
  sourceId: string;
};

const PLAY_EVENT_NAME = "soundmaxx-waveform-play";

function nextWaveformId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function WaveformPlayer({
  src,
  group,
  className,
  waveformClassName,
  buttonClassName,
  buttonLabelPlay = "Play Preview",
  buttonLabelPause = "Pause",
  height = 72,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const playerIdRef = useRef<string>(nextWaveformId());

  useEffect(() => {
    if (!group || typeof window === "undefined") return;

    const onWaveformPlay = (event: Event) => {
      const detail = (event as CustomEvent<WaveformPlayEvent>).detail;
      if (!detail) return;
      if (detail.group !== group || detail.sourceId === playerIdRef.current) return;

      const wave = waveRef.current;
      if (!wave || !wave.isPlaying()) return;
      wave.pause();
      setIsPlaying(false);
    };

    window.addEventListener(PLAY_EVENT_NAME, onWaveformPlay as EventListener);
    return () => {
      window.removeEventListener(PLAY_EVENT_NAME, onWaveformPlay as EventListener);
    };
  }, [group]);

  useEffect(() => {
    let cancelled = false;
    let wave: WaveSurfer | null = null;
    const onFinish = () => setIsPlaying(false);
    const onReady = () => setIsReady(true);
    const onError = () => setHasError(true);

    setIsPlaying(false);
    setIsReady(false);
    setHasError(false);

    const initWaveform = async () => {
      if (!containerRef.current) return;
      const { default: WaveSurferImpl } = await import("wavesurfer.js");
      if (cancelled || !containerRef.current) return;

      wave = WaveSurferImpl.create({
        container: containerRef.current,
        waveColor: "#c0b8a8",
        progressColor: "#ff3b00",
        cursorColor: "#0c0c0a",
        height,
        barWidth: 2,
        barGap: 1,
        normalize: true,
        dragToSeek: true,
        mediaControls: false,
      });

      waveRef.current = wave;
      wave.on("ready", onReady);
      wave.on("error", onError);
      wave.load(src);
      wave.on("finish", onFinish);
    };

    void initWaveform();

    return () => {
      cancelled = true;
      if (!wave) return;
      wave.un("ready", onReady);
      wave.un("error", onError);
      wave.un("finish", onFinish);
      wave.destroy();
      waveRef.current = null;
    };
  }, [src, height]);

  const togglePlayback = () => {
    if (!waveRef.current) return;
    if (!isReady || hasError) return;
    const willPlay = !waveRef.current.isPlaying();
    if (willPlay && group && typeof window !== "undefined") {
      const event = new CustomEvent<WaveformPlayEvent>(PLAY_EVENT_NAME, {
        detail: {
          group,
          sourceId: playerIdRef.current,
        },
      });
      window.dispatchEvent(event);
    }
    waveRef.current.playPause();
    setIsPlaying(waveRef.current.isPlaying());
  };

  return (
    <div
      className={cn("border p-3", className)}
      style={{ borderColor: "var(--muted)", background: "var(--card)" }}
    >
      <div ref={containerRef} aria-label="Waveform preview" className={cn("mb-3", waveformClassName)} />
      <button
        type="button"
        onClick={togglePlayback}
        className={cn("brutal-button-ghost px-3 text-[11px]", buttonClassName)}
        disabled={!isReady || hasError}
      >
        {isPlaying ? <PauseIcon className="size-3.5" /> : <PlayIcon className="size-3.5" />}
        {isPlaying ? buttonLabelPause : buttonLabelPlay}
      </button>
    </div>
  );
}
