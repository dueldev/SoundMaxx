"use client";

import React, { useEffect, useState } from "react";
import { PlusIcon } from "lucide-react";

interface CubeLoaderProps {
  size?: number;
  speed?: number;
  textSize?: number;
  statuses?: string[];
}

export const PrismFluxLoader: React.FC<CubeLoaderProps> = ({
  size = 48,
  speed = 5,
  textSize = 16,
  statuses = ["Fetching", "Fixing", "Updating", "Placing", "Syncing", "Processing"],
}) => {
  const [time, setTime] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => prev + 0.02 * speed);
    }, 16);
    return () => clearInterval(interval);
  }, [speed]);

  useEffect(() => {
    const statusInterval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 600);
    return () => clearInterval(statusInterval);
  }, [statuses.length]);

  const half = size / 2;
  const currentStatus = statuses[statusIndex];

  return (
    <div className="flex h-[190px] flex-col items-center justify-center gap-4">
      <div
        className="relative rounded-md"
        style={{
          width: size,
          height: size,
          transformStyle: "preserve-3d",
          transform: `rotateY(${time * 30}deg) rotateX(${time * 30}deg)`,
        }}
      >
        {statuses.slice(0, 6).map((_, i) => {
          const faceTransforms = [
            `rotateY(0deg) translateZ(${half}px)`,
            `rotateY(180deg) translateZ(${half}px)`,
            `rotateY(90deg) translateZ(${half}px)`,
            `rotateY(-90deg) translateZ(${half}px)`,
            `rotateX(90deg) translateZ(${half}px)`,
            `rotateX(-90deg) translateZ(${half}px)`,
          ];

          return (
            <div
              key={i}
              className="absolute flex items-center justify-center font-semibold text-foreground"
              style={{
                width: size,
                height: size,
                fontSize: `${textSize}px`,
                border: "1px solid color-mix(in srgb, var(--primary) 75%, var(--foreground) 25%)",
                background: "color-mix(in srgb, var(--card) 74%, transparent)",
                transform: faceTransforms[i],
                backfaceVisibility: "hidden",
              }}
            >
              <PlusIcon className="size-4 text-primary" />
            </div>
          );
        })}
      </div>

      <div className="smx-kicker text-center text-foreground">{currentStatus}...</div>
    </div>
  );
};
