import Link from "next/link";
import { sponsorForPlacement, type SponsorPlacement } from "@/lib/sponsors";

type SponsorSlotProps = {
  placement: SponsorPlacement;
  className?: string;
};

export function SponsorSlot({ placement, className }: SponsorSlotProps) {
  const sponsor = sponsorForPlacement(placement);
  if (!sponsor) return null;

  return (
    <aside className={className} aria-label="Sponsor message">
      <div className="brutal-card-flat p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--muted-foreground)" }}>
          Sponsor
        </p>
        <h3 className="mt-2 text-sm font-bold">{sponsor.name}</h3>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          {sponsor.blurb}
        </p>
        <Link href={sponsor.href} className="brutal-button-ghost mt-3 inline-flex px-3 py-2 text-[11px]" target="_blank" rel="noreferrer">
          {sponsor.cta}
        </Link>
      </div>
    </aside>
  );
}
