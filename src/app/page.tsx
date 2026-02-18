import { SoundmaxxDashboard } from "@/components/soundmaxx-dashboard";

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-24 top-8 h-[30rem] w-[30rem] rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="pointer-events-none absolute right-[-7rem] top-[-2rem] h-[26rem] w-[26rem] rounded-full bg-sky-300/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-9rem] left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-amber-200/40 blur-3xl" />
        <SoundmaxxDashboard />
      </div>
    </main>
  );
}
