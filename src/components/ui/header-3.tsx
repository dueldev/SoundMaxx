"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { createPortal } from "react-dom";
import {
  ActivityIcon,
  HomeIcon,
  MenuIcon,
  Music4Icon,
  SparklesIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { DEFAULT_TOOL_HREF, TOOL_CONFIGS } from "@/lib/tool-config";

function useScrolled(threshold: number) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}

function Brand() {
  return (
    <Link href="/" className="group inline-flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5" aria-label="SoundMaxx home">
      <span className="icon-pill size-8 rounded-lg border-border bg-card">
        <Music4Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-[0.01em]">SoundMaxx</span>
        <span className="block truncate text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Audio Command Deck</span>
      </span>
    </Link>
  );
}

function NavLink({ href, label, active, icon: Icon }: { href: string; label: string; active: boolean; icon: typeof HomeIcon }) {
  return (
    <NavigationMenuLink asChild>
      <Link
        href={href}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold uppercase tracking-[0.1em] transition",
          active
            ? "border-[color-mix(in_srgb,var(--brand-cobalt)_52%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]"
            : "border-transparent hover:border-border hover:bg-accent/10",
        )}
        aria-current={active ? "page" : undefined}
      >
        <Icon className="size-3.5" />
        {label}
      </Link>
    </NavigationMenuLink>
  );
}

function MobileMenu({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open || typeof window === "undefined") return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 top-[5.2rem] z-40 bg-background/96 px-3 pb-4 backdrop-blur-lg md:hidden">
      <div className="menu-surface mx-auto mt-2 flex h-full max-w-3xl flex-col gap-2 overflow-y-auto rounded-xl bg-card/96 p-3">{children}</div>
    </div>,
    document.body,
  );
}

export function Header() {
  const pathname = usePathname() ?? "/";
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const scrolled = useScrolled(16);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="sticky top-0 z-50 py-3">
        <div className={cn("smx-shell smx-nav-shell transition-all", scrolled && "scrolled")}>
          <div className="flex h-16 items-center justify-between gap-2 px-2 md:px-3">
            <Brand />

            <NavigationMenu className="hidden md:flex">
              <NavigationMenuList className="gap-1">
                <NavigationMenuItem>
                  <NavLink href="/" label="Home" icon={HomeIcon} active={pathname === "/"} />
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavLink href="/ops" label="Ops" icon={ActivityIcon} active={pathname === "/ops"} />
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuTrigger className="h-9 border border-transparent bg-transparent px-3 text-xs font-semibold uppercase tracking-[0.1em] hover:border-border hover:bg-accent/10">
                    <WrenchIcon className="mr-2 size-3.5" />
                    Tools
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="menu-surface mt-2 rounded-xl bg-card/95 p-2 backdrop-blur-xl">
                    <ul className="grid w-[min(92vw,34rem)] gap-1 md:grid-cols-2">
                      {TOOL_CONFIGS.map((tool) => (
                        <li key={tool.slug}>
                          <NavigationMenuLink asChild>
                            <Link
                              href={tool.href}
                              className={cn(
                                "menu-item block rounded-lg border border-transparent px-3 py-2 transition hover:border-border hover:bg-accent/10",
                                pathname === tool.href && "border-[color-mix(in_srgb,var(--brand-cobalt)_46%,var(--border))] bg-accent/10",
                              )}
                            >
                              <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.11em]">
                                <SparklesIcon className="size-3.5 text-primary" />
                                {tool.navLabel}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            <div className="hidden items-center gap-2 md:flex">
              <ThemeToggle />
              <Button asChild className="smx-button-primary h-9 px-4 text-[11px]">
                <Link href={DEFAULT_TOOL_HREF}>Open Tool</Link>
              </Button>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setMobileOpen((value) => !value)}
                aria-label="Toggle menu"
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
                className="button-ghost inline-flex size-10 items-center justify-center"
              >
                {mobileOpen ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <MobileMenu open={mobileOpen}>
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className={cn(
            "menu-item rounded-lg border px-3 py-3 text-xs font-semibold uppercase tracking-[0.1em]",
            pathname === "/" ? "border-primary/45 bg-accent/10" : "border-transparent",
          )}
        >
          <span className="inline-flex items-center gap-2">
            <HomeIcon className="size-3.5" />
            Home
          </span>
        </Link>

        <Link
          href="/ops"
          aria-current={pathname === "/ops" ? "page" : undefined}
          className={cn(
            "menu-item rounded-lg border px-3 py-3 text-xs font-semibold uppercase tracking-[0.1em]",
            pathname === "/ops" ? "border-primary/45 bg-accent/10" : "border-transparent",
          )}
        >
          <span className="inline-flex items-center gap-2">
            <ActivityIcon className="size-3.5" />
            Ops
          </span>
        </Link>

        <div className="smx-frame space-y-2 rounded-xl p-3">
          <p className="smx-kicker">Tool Routes</p>
          {TOOL_CONFIGS.map((tool) => (
            <Link
              key={tool.slug}
              href={tool.href}
              aria-current={pathname === tool.href ? "page" : undefined}
              className={cn(
                "menu-item block rounded-lg border px-3 py-3",
                pathname === tool.href ? "border-primary/45 bg-accent/10" : "border-transparent",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.1em]">{tool.navLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
            </Link>
          ))}
        </div>

        <Button asChild className="smx-button-primary h-11 text-[11px]">
          <Link href={DEFAULT_TOOL_HREF}>Open Tool</Link>
        </Button>
      </MobileMenu>
    </>
  );
}
