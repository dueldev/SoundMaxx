"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconBolt, IconLayoutGrid } from "@tabler/icons-react";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import { ToolsMenu } from "@/components/navigation/tools-menu";
import { UtilityMenu } from "@/components/navigation/utility-menu";
import {
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavBody,
  Navbar,
} from "@/components/ui/resizable-navbar";
import { DEFAULT_TOOL_HREF, TOOL_CONFIGS } from "@/lib/tool-config";

function navLinkClasses(active: boolean) {
  return `button-ghost rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.08em] ${active ? "border-[var(--surface-border-strong)] bg-[var(--accent-muted)]" : ""}`;
}

function BrandLockup() {
  return (
    <Link href="/" className="group flex min-w-0 items-center gap-3" aria-label="SoundMaxx home">
      <span className="icon-pill h-9 w-9 rounded-md border-[var(--surface-border-strong)] text-[11px] font-semibold uppercase tracking-[0.2em]">SM</span>
      <span className="min-w-0">
        <span className="display-title block truncate text-[1.05rem]">SoundMaxx</span>
        <span className="text-muted block truncate text-[10px] uppercase tracking-[0.12em]">Audio Command Deck</span>
      </span>
    </Link>
  );
}

export function AppHeader() {
  const pathname = usePathname() ?? "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setCompact(window.scrollY > 24);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Navbar className="top-0 z-[70] px-3 pt-3 md:px-5">
        <NavBody className={`header-shell signal-spine-x ${compact ? "header-shell-compact py-2" : "py-3"}`}>
          <div className="flex w-full items-center justify-between gap-3 px-2 md:px-4">
            <BrandLockup />

            <nav aria-label="Primary" className="hidden items-center gap-2 md:flex">
              <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={navLinkClasses(pathname === "/")}>
                Home
              </Link>
              <ToolsMenu pathname={pathname} />
            </nav>

            <div className="hidden items-center gap-2 md:flex">
              <ThemeToggle />
              <UtilityMenu pathname={pathname} />
              <Link href={DEFAULT_TOOL_HREF} className="button-primary animate-shimmer rounded-md px-4 py-2 text-xs uppercase tracking-[0.1em]">
                <IconBolt size={14} />
                Open Tool
              </Link>
            </div>
          </div>
        </NavBody>

        <MobileNav className="header-shell signal-spine-x py-2">
          <MobileNavHeader className="px-2">
            <BrandLockup />

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav-panel"
                onClick={() => setMobileOpen((prev) => !prev)}
                className="button-ghost inline-flex h-10 w-10 items-center justify-center rounded-md"
              >
                <span className="sr-only">Open navigation</span>
                <MobileNavToggle isOpen={mobileOpen} />
              </button>
            </div>
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={mobileOpen}
            onClose={() => setMobileOpen(false)}
            className="menu-surface signal-spine-x gap-2 rounded-md border p-3"
          >
            <Link
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={navLinkClasses(pathname === "/")}
            >
              Home
            </Link>
            {TOOL_CONFIGS.map((tool, index) => (
              <Link
                key={tool.slug}
                href={tool.href}
                aria-current={pathname === tool.href ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                style={{ animationDelay: `${index * 45}ms` }}
                className={`button-secondary hover-lift animate-rise rounded-md px-3 py-2 text-xs uppercase tracking-[0.08em] ${
                  pathname === tool.href ? "border-[var(--surface-border-strong)]" : ""
                }`}
              >
                <IconLayoutGrid size={13} />
                {tool.navLabel}
              </Link>
            ))}
            <Link
              href="/ops"
              aria-current={pathname === "/ops" ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={navLinkClasses(pathname === "/ops")}
            >
              Ops Dashboard
            </Link>
            <Link href={DEFAULT_TOOL_HREF} onClick={() => setMobileOpen(false)} className="button-primary rounded-md px-3 py-2 text-xs uppercase tracking-[0.08em]">
              <IconBolt size={13} />
              Open Tool
            </Link>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>
    </>
  );
}
