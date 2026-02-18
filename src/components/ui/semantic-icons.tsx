import {
  IconAdjustments,
  IconAlertTriangle,
  IconChecks,
  IconClockHour4,
  IconGauge,
  IconMusic,
  IconPlayerPlay,
  IconSkull,
  IconWaveSine,
} from "@tabler/icons-react";
import type { JobStatus, ToolType } from "@/types/domain";

type IconProps = {
  size?: number;
  className?: string;
};

export function ToolTypeIcon({ toolType, size = 16, className }: { toolType: ToolType } & IconProps) {
  if (toolType === "stem_isolation") return <IconWaveSine size={size} className={className} aria-hidden="true" />;
  if (toolType === "mastering") return <IconAdjustments size={size} className={className} aria-hidden="true" />;
  if (toolType === "key_bpm") return <IconClockHour4 size={size} className={className} aria-hidden="true" />;
  if (toolType === "loudness_report") return <IconGauge size={size} className={className} aria-hidden="true" />;
  return <IconMusic size={size} className={className} aria-hidden="true" />;
}

export function JobStatusIcon({ status, size = 16, className }: { status: JobStatus } & IconProps) {
  if (status === "queued" || status === "running") {
    return <IconPlayerPlay size={size} className={className} aria-hidden="true" />;
  }
  if (status === "succeeded") {
    return <IconChecks size={size} className={className} aria-hidden="true" />;
  }
  if (status === "expired") {
    return <IconSkull size={size} className={className} aria-hidden="true" />;
  }
  return <IconAlertTriangle size={size} className={className} aria-hidden="true" />;
}
