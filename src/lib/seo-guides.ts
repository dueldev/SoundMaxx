export type SeoGuide = {
  slug: string;
  title: string;
  description: string;
  focusKeyword: string;
  toolHref: "/tools/stem-isolation" | "/tools/mastering" | "/tools/key-bpm" | "/tools/loudness-report" | "/tools/midi-extract";
  intro: string;
  sections: Array<{
    heading: string;
    paragraphs: string[];
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
};

export const SEO_GUIDES: SeoGuide[] = [
  {
    slug: "audio-stem-isolation",
    title: "Audio Stem Isolation Online: Practical Guide for Producers",
    description:
      "Learn audio stem isolation workflows for vocals, drums, bass, and instrument separation, including quality checks and export tips.",
    focusKeyword: "audio stem isolation",
    toolHref: "/tools/stem-isolation",
    intro:
      "Audio stem isolation lets you split a mixed track into usable parts such as vocals, drums, bass, and music. The key is getting clean enough separation for your workflow, then validating artifacts before export.",
    sections: [
      {
        heading: "When audio stem isolation is useful",
        paragraphs: [
          "Stem separation is most useful when you need to remix, build practice stems, prepare performance edits, or inspect arrangement details in a finished mix.",
          "It is not a perfect source replacement for every production. Separation quality depends on the source mix density, effects processing, and masking between instruments.",
        ],
      },
      {
        heading: "Workflow that improves separation quality",
        paragraphs: [
          "Start with the highest quality source file available. Lossy transcodes reduce separation quality and often increase bleed between stems.",
          "Use the split that fits your task. Two-way splits can be faster for vocal versus instrumental. Four-way splits are better when drums and bass need independent control.",
        ],
      },
      {
        heading: "Quality checks before using stems",
        paragraphs: [
          "After processing, listen for phasey tails, cymbal bleed in vocal stems, and low-end leakage between bass and instrumental layers.",
          "For production use, A/B each stem against the original context and check mono compatibility before commit.",
        ],
      },
      {
        heading: "Use SoundMaxx for stem isolation",
        paragraphs: [
          "If you want browser-based audio stem isolation with upload, processing status, and exports in one flow, run the SoundMaxx stem isolation tool.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can stem isolation fully remove vocal bleed?",
        answer:
          "Not always. Modern models can reduce bleed significantly, but dense mixes and heavy effects can still leave residue in isolated stems.",
      },
      {
        question: "Is WAV better than MP3 for stem separation?",
        answer:
          "Yes. Uncompressed or higher-bitrate sources typically produce cleaner isolation and fewer audible artifacts.",
      },
    ],
  },
  {
    slug: "free-audio-mastering",
    title: "Free Audio Mastering Online: Fast Pre-Master Workflow",
    description:
      "Use a free audio mastering workflow to improve loudness, tonal balance, and translation before final release mastering.",
    focusKeyword: "free audio mastering",
    toolHref: "/tools/mastering",
    intro:
      "Free audio mastering tools are best used for rapid iteration and client previews. A solid workflow focuses on controlled loudness, balanced EQ, and avoiding clipping artifacts.",
    sections: [
      {
        heading: "What free audio mastering should do well",
        paragraphs: [
          "A reliable free mastering pass should tighten dynamics, improve spectral balance, and lift level without collapsing transients.",
          "It should also let you audition different intensity levels so you can avoid over-processing on dense mixes.",
        ],
      },
      {
        heading: "Pre-master checklist before processing",
        paragraphs: [
          "Leave headroom in your mix export and avoid clipping before mastering. Poor upstream gain staging limits what mastering can fix.",
          "Check low-end buildup and harsh upper mids in the mix first. Mastering can polish, but not fully repair a broken balance.",
        ],
      },
      {
        heading: "Mastering decisions to validate",
        paragraphs: [
          "Compare loudness, punch, and tonal tilt across multiple references at matched playback level.",
          "Confirm that limiting does not smear kick transients or distort vocal peaks at chorus sections.",
        ],
      },
      {
        heading: "Use SoundMaxx for free audio mastering",
        paragraphs: [
          "Run SoundMaxx mastering when you need a quick browser workflow for mastering previews, with settings control and downloadable output.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can free mastering be release-ready?",
        answer:
          "It can be good enough for many demos and independent releases, but final commercial delivery may still need deeper manual QA and revision.",
      },
      {
        question: "Should I master to the loudest possible level?",
        answer:
          "No. Prioritize clarity and translation. Over-maximizing loudness can reduce punch and create distortion.",
      },
    ],
  },
  {
    slug: "key-bpm-detection",
    title: "Key and BPM Detection Online: Accurate Prep for DJ and Production",
    description:
      "Detect musical key and BPM online, then validate edge cases for tempo drift, swing, and ambiguous harmonic content.",
    focusKeyword: "key bpm detection",
    toolHref: "/tools/key-bpm",
    intro:
      "Key and BPM detection speeds up organization, DJ prep, mashup planning, and production decisions. Accuracy improves when you verify results on tricky material.",
    sections: [
      {
        heading: "Where key and BPM detection saves time",
        paragraphs: [
          "Producers and DJs use key and tempo metadata for crate prep, harmonic transitions, and quicker sample placement.",
          "Teams also use automated key/BPM tagging to normalize large audio libraries before editorial work.",
        ],
      },
      {
        heading: "Common detection edge cases",
        paragraphs: [
          "Tempo can drift on live recordings and older masters, which may produce unstable BPM estimates.",
          "Harmonic ambiguity appears with modal tracks, sparse intros, and heavily processed tonal content.",
        ],
      },
      {
        heading: "Validation workflow",
        paragraphs: [
          "Spot-check chorus and verse sections separately if key predictions look uncertain.",
          "For BPM, compare detected value against beat-grid alignment and practical double/half-time alternatives.",
        ],
      },
      {
        heading: "Use SoundMaxx for key and BPM detection",
        paragraphs: [
          "SoundMaxx provides a browser-based key and BPM detection workflow so you can process tracks and keep metadata with the same tool stack.",
        ],
      },
    ],
    faqs: [
      {
        question: "Why does BPM sometimes appear doubled or halved?",
        answer:
          "Beat trackers can lock to subdivisions depending on rhythm emphasis, so double-time and half-time readings are common alternatives.",
      },
      {
        question: "Can one song have more than one key?",
        answer:
          "Yes. Modulation and tonal shifts can cause different sections to resolve to different centers.",
      },
    ],
  },
  {
    slug: "loudness-analysis",
    title: "Loudness Analysis Online: LUFS, True Peak, and Dynamics",
    description:
      "Run loudness analysis online to measure LUFS, true peak, and dynamic range before distribution.",
    focusKeyword: "loudness analysis",
    toolHref: "/tools/loudness-report",
    intro:
      "Loudness analysis helps prevent delivery surprises. Measuring LUFS, true peak, and dynamics before release keeps mixes consistent across platforms and playback contexts.",
    sections: [
      {
        heading: "What to measure before release",
        paragraphs: [
          "Integrated loudness (LUFS) gives an overall level target reference, while true peak helps avoid inter-sample clipping on playback conversion.",
          "Dynamic range and short-term behavior reveal whether sections are too compressed or inconsistent in energy.",
        ],
      },
      {
        heading: "Platform normalization reality",
        paragraphs: [
          "Different streaming platforms normalize playback differently, so loudness strategy should focus on clarity after normalization, not only absolute meter values.",
          "A balanced master with clean transients often performs better than an aggressively limited one in normalized playback.",
        ],
      },
      {
        heading: "Practical QA pass",
        paragraphs: [
          "Measure the full track, then inspect loudest sections and transitions to catch peak overs or pumping artifacts.",
          "Export revisions only after meter checks and listening checks agree.",
        ],
      },
      {
        heading: "Use SoundMaxx for loudness analysis",
        paragraphs: [
          "SoundMaxx loudness reporting provides quick browser-based measurement for LUFS targets, true peak checks, and release QA workflows.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is one LUFS target correct for every platform?",
        answer:
          "No. Platforms normalize differently. Use loudness targets as guidance and validate how the master behaves after normalization.",
      },
      {
        question: "Why does true peak matter if sample peaks look safe?",
        answer:
          "Inter-sample peaks can exceed sample values during conversion or playback reconstruction, causing distortion.",
      },
    ],
  },
  {
    slug: "audio-to-midi-converter",
    title: "Audio to MIDI Converter Online: Melody Extraction Workflow",
    description:
      "Convert audio to MIDI online and clean extracted notes for arrangement, reharmonization, and instrument replacement.",
    focusKeyword: "audio to midi converter",
    toolHref: "/tools/midi-extract",
    intro:
      "Audio to MIDI conversion is useful for turning melodic audio ideas into editable note data. Best results come from clear monophonic or lightly layered sources and a short cleanup pass.",
    sections: [
      {
        heading: "Best input sources for audio-to-MIDI",
        paragraphs: [
          "Clean melodic lines with stable pitch and limited overlap usually convert more accurately than dense polyphonic mixes.",
          "Reduce noisy tails and excessive ambience before conversion when possible.",
        ],
      },
      {
        heading: "Post-conversion cleanup process",
        paragraphs: [
          "After conversion, tighten note starts, merge fragmented notes, and remove low-confidence artifacts.",
          "Quantize lightly and preserve expressive timing where it supports musical feel.",
        ],
      },
      {
        heading: "Creative uses",
        paragraphs: [
          "Use extracted MIDI for sound replacement, harmonization experiments, notation drafting, and quick arrangement blockouts.",
          "Audio-to-MIDI is especially useful when sketching ideas away from an instrument or rebuilding parts from voice memos.",
        ],
      },
      {
        heading: "Use SoundMaxx as an audio to MIDI converter",
        paragraphs: [
          "SoundMaxx MIDI extraction gives you an online audio to MIDI converter workflow for fast idea capture and DAW handoff.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does audio-to-MIDI work for full mixes?",
        answer:
          "It can extract usable information, but dense full mixes generally need more cleanup than isolated melodic sources.",
      },
      {
        question: "Why are there extra short notes in the MIDI output?",
        answer:
          "Transient noise, overlapping harmonics, and pitch uncertainty can produce micro-notes that should be cleaned in post-editing.",
      },
    ],
  },
];

export function getSeoGuideBySlug(slug: string) {
  return SEO_GUIDES.find((guide) => guide.slug === slug);
}
