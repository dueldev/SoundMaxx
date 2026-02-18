"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { ToolTypeIcon } from "@/components/ui/semantic-icons";
import { TOOL_CONFIGS } from "@/lib/tool-config";

type ToolsMenuProps = {
  pathname: string;
};

const MENU_ID = "tools-menu-dropdown";

export function ToolsMenu({ pathname }: ToolsMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const focusItem = (index: number) => {
    const items = itemRefs.current.filter(Boolean) as HTMLAnchorElement[];
    if (items.length === 0) return;
    const normalized = (index + items.length) % items.length;
    items[normalized]?.focus();
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  const onButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusItem(0));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusItem(TOOL_CONFIGS.length - 1));
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((prev) => !prev);
      if (!open) {
        requestAnimationFrame(() => focusItem(0));
      }
    }
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter(Boolean) as HTMLAnchorElement[];
    const activeIndex = items.findIndex((item) => item === document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(activeIndex + 1);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(activeIndex - 1);
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    }

    if (event.key === "End") {
      event.preventDefault();
      focusItem(items.length - 1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-label="Tools menu"
        aria-expanded={open}
        aria-controls={MENU_ID}
        data-testid="nav-tools-button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onButtonKeyDown}
        className="button-ghost rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.09em]"
      >
        Tools
      </button>

      {open ? (
        <div
          id={MENU_ID}
          role="menu"
          aria-label="Tools"
          onKeyDown={onMenuKeyDown}
          className="menu-surface signal-spine-x absolute right-0 z-50 mt-2 w-[21rem] rounded-md p-2"
        >
          {TOOL_CONFIGS.map((tool, index) => (
            <Link
              key={tool.slug}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              role="menuitem"
              tabIndex={-1}
              aria-current={pathname === tool.href ? "page" : undefined}
              href={tool.href}
              onClick={() => setOpen(false)}
              className="menu-item signal-spine-y block rounded-sm px-3 py-2 transition"
            >
              <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.09em]">
                <span className="inline-flex items-center gap-2">
                  <ToolTypeIcon toolType={tool.toolType} size={14} />
                  {tool.navLabel}
                </span>
                {pathname === tool.href ? <span className="metric-chip">Current</span> : null}
              </p>
              <p className="text-muted mt-1 pl-6 text-[11px] leading-relaxed">{tool.description}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
