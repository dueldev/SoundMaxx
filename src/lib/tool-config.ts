import {
  MASTERING_PRESETS,
  type MasteringPreset,
  type ToolParamsMap,
  type ToolType,
} from "@/types/domain";

export const TOOL_SLUGS = [
  "stem-isolation",
  "mastering",
  "key-bpm",
  "loudness-report",
  "midi-extract",
] as const;

export type ToolSlug = (typeof TOOL_SLUGS)[number];

export type ToolUiDefaults = {
  stems: 2 | 4;
  masteringPreset: MasteringPreset;
  masteringIntensity: number;
  includeChordHints: boolean;
  targetLufs: number;
  midiSensitivity: number;
};

export type ToolConfig<T extends ToolType = ToolType> = {
  slug: ToolSlug;
  toolType: T;
  label: string;
  navLabel: string;
  description: string;
  marketingBlurb: string;
  href: `/tools/${ToolSlug}`;
  defaultParams: ToolParamsMap[T];
  defaults: ToolUiDefaults;
};

const defaultMasteringPreset: MasteringPreset = MASTERING_PRESETS[0];

const sharedDefaults: ToolUiDefaults = {
  stems: 4,
  masteringPreset: defaultMasteringPreset,
  masteringIntensity: 70,
  includeChordHints: true,
  targetLufs: -14,
  midiSensitivity: 0.5,
};

function createToolConfig<T extends ToolType>(config: ToolConfig<T>): ToolConfig<T> {
  return config;
}

export const TOOL_CONFIGS = [
  createToolConfig({
    slug: "stem-isolation",
    toolType: "stem_isolation",
    label: "Stem Isolation",
    navLabel: "Stem Isolation",
    description: "Separate vocals, drums, bass, and music into clean stems.",
    marketingBlurb: "Pull apart full mixes into stems for remixing, practice, and arrangement edits.",
    href: "/tools/stem-isolation",
    defaultParams: { stems: sharedDefaults.stems },
    defaults: sharedDefaults,
  }),
  createToolConfig({
    slug: "mastering",
    toolType: "mastering",
    label: "Mastering",
    navLabel: "Mastering",
    description: "Shape loudness, tone, and energy for release-ready mixes.",
    marketingBlurb: "Give your track a polished finish that translates better across speakers and platforms.",
    href: "/tools/mastering",
    defaultParams: {
      preset: sharedDefaults.masteringPreset,
      intensity: sharedDefaults.masteringIntensity,
    },
    defaults: sharedDefaults,
  }),
  createToolConfig({
    slug: "key-bpm",
    toolType: "key_bpm",
    label: "Key + BPM Detection",
    navLabel: "Key + BPM",
    description: "Identify musical key and tempo for faster production workflows.",
    marketingBlurb: "Quickly detect harmonic and tempo metadata to organize, DJ, and remix with confidence.",
    href: "/tools/key-bpm",
    defaultParams: {
      includeChordHints: sharedDefaults.includeChordHints,
    },
    defaults: sharedDefaults,
  }),
  createToolConfig({
    slug: "loudness-report",
    toolType: "loudness_report",
    label: "Loudness Report",
    navLabel: "Loudness Report",
    description: "Measure loudness, true peak, and dynamic range before release.",
    marketingBlurb: "Check if your music hits loudness targets and avoid clipping before publishing.",
    href: "/tools/loudness-report",
    defaultParams: {
      targetLufs: sharedDefaults.targetLufs,
    },
    defaults: sharedDefaults,
  }),
  createToolConfig({
    slug: "midi-extract",
    toolType: "midi_extract",
    label: "MIDI Extraction",
    navLabel: "MIDI Extraction",
    description: "Convert melodic material into editable MIDI for your DAW.",
    marketingBlurb: "Turn audio ideas into MIDI notes you can edit, reharmonize, and reuse.",
    href: "/tools/midi-extract",
    defaultParams: {
      sensitivity: sharedDefaults.midiSensitivity,
    },
    defaults: sharedDefaults,
  }),
] as const;

export const DEFAULT_TOOL_CONFIG = TOOL_CONFIGS[0];
export const DEFAULT_TOOL_HREF = DEFAULT_TOOL_CONFIG.href;

const TOOL_CONFIG_BY_SLUG = new Map<ToolSlug, ToolConfig>(TOOL_CONFIGS.map((config) => [config.slug, config]));
const TOOL_CONFIG_BY_TYPE = new Map<ToolType, ToolConfig>(TOOL_CONFIGS.map((config) => [config.toolType, config]));

export function getToolConfigBySlug(slug: string): ToolConfig | undefined {
  if (!TOOL_SLUGS.includes(slug as ToolSlug)) {
    return undefined;
  }

  return TOOL_CONFIG_BY_SLUG.get(slug as ToolSlug);
}

export function getToolConfigByType(toolType: ToolType): ToolConfig | undefined {
  return TOOL_CONFIG_BY_TYPE.get(toolType);
}
