export type SponsorPlacement = "home_top" | "home_bottom" | "tool_inline";

export type SponsorConfig = {
  id: string;
  name: string;
  placement: SponsorPlacement;
  href: string;
  cta: string;
  blurb: string;
};

export const SPONSOR_SLOTS: SponsorConfig[] = [
  {
    id: "spn-sonicmaster-home",
    name: "SonicMaster",
    placement: "home_top",
    href: "https://example.com/sponsors/sonicmaster",
    cta: "Explore Sponsor",
    blurb: "Sponsor spotlight for mastering and release workflows.",
  },
  {
    id: "spn-wavekit-home",
    name: "WaveKit",
    placement: "home_bottom",
    href: "https://example.com/sponsors/wavekit",
    cta: "Visit WaveKit",
    blurb: "Partner tools for stem editing and production organization.",
  },
  {
    id: "spn-midi-grid-tool",
    name: "MidiGrid",
    placement: "tool_inline",
    href: "https://example.com/sponsors/midigrid",
    cta: "Try MidiGrid",
    blurb: "Sponsored resource for MIDI composition and arrangement.",
  },
];

export function sponsorForPlacement(placement: SponsorPlacement) {
  return SPONSOR_SLOTS.find((slot) => slot.placement === placement) ?? null;
}
