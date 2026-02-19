"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { createPortal } from "react-dom";
import { MenuIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOL_CONFIGS } from "@/lib/tool-config";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 10 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-2.5"
      style={{
        transition: "transform 220ms ease",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
      }}
      aria-hidden="true"
    >
      <path d="M1 1l4 4 4-4" />
    </svg>
  );
}

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
      {/* Trigger — styled to match NavLink */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          "relative flex items-center gap-1.5 pb-0.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] transition-colors duration-150",
          isToolActive || open ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        Tools
        <Chevron open={open} />
        {isToolActive && (
          <span
            className="absolute inset-x-0 -bottom-0.5 h-[2px]"
            style={{ background: "var(--accent)" }}
          />
        )}
      </button>

      {/* Dropdown panel — always mounted, animated via CSS */}
      <div
        className="absolute right-0 top-full z-50 mt-3 w-72 border"
        style={{
          background: "var(--card)",
          borderColor: "var(--foreground)",
          boxShadow: "4px 4px 0 var(--foreground)",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-10px)",
          visibility: open ? "visible" : "hidden",
          transition: "opacity 200ms ease, transform 200ms ease",
          pointerEvents: open ? "auto" : "none",
        }}
        role="menu"
      >
        {TOOL_CONFIGS.map((tool) => {
          const isActive = pathname === tool.href;
          return (
            <Link
              key={tool.slug}
              href={tool.href}
              prefetch={false}
              onClick={() => setOpen(false)}
              role="menuitem"
              className={cn(
                "flex items-start gap-3 border-b px-4 py-3.5 transition-colors duration-100 last:border-b-0",
                isActive ? "bg-[var(--accent)]" : "hover:bg-[var(--muted)]",
              )}
              style={{ borderColor: "var(--muted)" }}
            >
              <span
                className="mt-0.5 font-mono text-[11px] font-bold leading-none"
                style={{ color: isActive ? "rgba(255,255,255,0.5)" : "var(--accent)" }}
              >
                {String(TOOL_CONFIGS.indexOf(tool) + 1).padStart(2, "0")}
              </span>
              <span>
                <p
                  className="font-mono text-xs font-bold uppercase tracking-[0.12em]"
                  style={{ color: isActive ? "#fff" : "var(--foreground)" }}
                >
                  {tool.navLabel}
                </p>
                <p
                  className="mt-0.5 text-xs leading-snug"
                  style={{ color: isActive ? "rgba(255,255,255,0.75)" : "var(--muted-foreground)" }}
                >
                  {tool.description}
                </p>
              </span>
            </Link>
          );
        })}
      </div>
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
      <div className="smx-shell flex flex-1 flex-col py-8">
        {/* Home */}
        <Link
          href="/"
          onClick={onClose}
          className={cn(
            "border-b py-5 text-2xl font-bold tracking-[-0.01em] transition-colors",
            pathname === "/" ? "text-[var(--accent)]" : "hover:text-[var(--accent)]",
          )}
          style={{ borderColor: "var(--muted)" }}
        >
          Home
        </Link>

        {/* Tools */}
        <p
          className="mt-7 mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: "var(--muted-foreground)" }}
        >
          Tools
        </p>
        {TOOL_CONFIGS.map((tool, i) => (
          <Link
            key={tool.slug}
            href={tool.href}
            prefetch={false}
            onClick={onClose}
            className={cn(
              "flex items-baseline gap-3 border-b py-4 transition-colors",
              pathname === tool.href ? "text-[var(--accent)]" : "hover:text-[var(--accent)]",
            )}
            style={{ borderColor: "var(--muted)" }}
          >
            <span className="font-mono text-xs font-bold" style={{ color: "var(--accent)", opacity: 0.5 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-lg font-semibold">{tool.navLabel}</span>
          </Link>
        ))}
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
        <div className="smx-shell flex h-16 items-center justify-between">
          {/* Wordmark */}
          <Link
            href="/"
            className="font-bold transition-colors hover:text-[var(--accent)]"
            style={{ fontSize: "1.05rem", letterSpacing: "-0.01em" }}
            aria-label="SoundMaxx home"
          >
            SOUNDMAXX
          </Link>

          {/* Desktop nav — right side */}
          <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
            <NavLink href="/" label="Home" active={pathname === "/"} />
            <ToolsDropdown pathname={pathname} />
          </nav>

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
