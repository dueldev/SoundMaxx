"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { createPortal } from "react-dom";
import { MenuIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_TOOL_HREF, TOOL_CONFIGS } from "@/lib/tool-config";

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative pb-0.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] transition-colors duration-150",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {active && (
        <span
          className="absolute inset-x-0 -bottom-0.5 h-[2px]"
          style={{ background: "var(--accent)" }}
        />
      )}
    </Link>
  );
}

function ToolsDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close when route changes
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close on Escape key
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const isToolActive = TOOL_CONFIGS.some((t) => t.href === pathname);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "relative pb-0.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] transition-colors duration-150",
          isToolActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        Tools ▾
        {isToolActive && (
          <span
            className="absolute inset-x-0 -bottom-0.5 h-[2px]"
            style={{ background: "var(--accent)" }}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-64 border"
          style={{
            background: "var(--card)",
            borderColor: "var(--foreground)",
            boxShadow: "4px 4px 0 var(--foreground)",
          }}
        >
          {TOOL_CONFIGS.map((tool) => (
            <Link
              key={tool.slug}
              href={tool.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block border-b px-4 py-3 text-left transition-colors duration-100 last:border-b-0",
                pathname === tool.href
                  ? "bg-[var(--accent)] text-white"
                  : "hover:bg-[var(--muted)]",
              )}
              style={{ borderColor: "var(--muted)" }}
            >
              <p className="font-mono text-xs font-bold uppercase tracking-[0.12em]">{tool.navLabel}</p>
              <p className="mt-0.5 text-xs" style={{ color: pathname === tool.href ? "rgba(255,255,255,0.8)" : "var(--muted-foreground)" }}>
                {tool.description}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileMenu({ open, pathname, onClose }: { open: boolean; pathname: string; onClose: () => void }) {
  if (!open || typeof window === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto md:hidden"
      style={{ background: "var(--background)", borderTop: "1.5px solid var(--foreground)" }}
    >
      <div className="smx-shell flex flex-1 flex-col gap-1 py-8">
        {[
          { href: "/", label: "Home" },
          { href: "/ops", label: "Ops" },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              "border-b py-4 font-bold",
              "text-2xl tracking-[-0.01em] transition-colors",
              pathname === href ? "text-[var(--accent)]" : "hover:text-[var(--accent)]",
            )}
            style={{ borderColor: "var(--muted)" }}
          >
            {label}
          </Link>
        ))}

        <p
          className="mt-4 mb-2 font-mono text-xs font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--muted-foreground)" }}
        >
          Tools
        </p>
        {TOOL_CONFIGS.map((tool) => (
          <Link
            key={tool.slug}
            href={tool.href}
            onClick={onClose}
            className={cn(
              "border-b py-3 font-semibold text-lg transition-colors",
              pathname === tool.href ? "text-[var(--accent)]" : "hover:text-[var(--accent)]",
            )}
            style={{ borderColor: "var(--muted)" }}
          >
            {tool.navLabel}
          </Link>
        ))}

        <Link
          href={DEFAULT_TOOL_HREF}
          onClick={onClose}
          className="brutal-button-primary mt-8 justify-center text-sm"
          style={{ display: "flex" }}
        >
          Open Studio →
        </Link>
      </div>
    </div>,
    document.body,
  );
}

export function Header() {
  const pathname = usePathname() ?? "/";
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <header
        className="sticky top-0 z-50 bg-[var(--background)]"
        style={{ borderBottom: "1.5px solid var(--foreground)" }}
      >
        <div className="smx-shell flex h-16 items-center justify-between gap-4">
          {/* Wordmark */}
          <Link
            href="/"
            className="font-bold tracking-[-0.02em] transition-colors hover:text-[var(--accent)]"
            style={{ fontSize: "1.1rem", letterSpacing: "-0.01em" }}
            aria-label="SoundMaxx home"
          >
            SOUNDMAXX
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
            <NavLink href="/" label="Home" active={pathname === "/"} />
            <NavLink href="/ops" label="Ops" active={pathname === "/ops"} />
            <ToolsDropdown pathname={pathname} />
          </nav>

          {/* Desktop CTA */}
          <div className="hidden items-center md:flex">
            <Link href={DEFAULT_TOOL_HREF} className="brutal-button-primary px-5 text-xs">
              Open Studio →
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            className="inline-flex size-11 items-center justify-center border md:hidden"
            style={{ borderColor: "var(--foreground)" }}
          >
            {mobileOpen ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
          </button>
        </div>
      </header>

      <MobileMenu open={mobileOpen} pathname={pathname} onClose={() => setMobileOpen(false)} />
    </>
  );
}
