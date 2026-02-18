"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { IconActivity } from "@tabler/icons-react";

type UtilityMenuProps = {
  pathname: string;
};

const MENU_ID = "utility-menu-dropdown";

export function UtilityMenu({ pathname }: UtilityMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const itemRef = useRef<HTMLAnchorElement | null>(null);

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
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => itemRef.current?.focus());
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-label="Utility menu"
        aria-expanded={open}
        aria-controls={MENU_ID}
        data-testid="nav-utility-button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onButtonKeyDown}
        className="button-ghost rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.09em]"
      >
        Utility
      </button>

      {open ? (
        <div id={MENU_ID} role="menu" aria-label="Utility" className="menu-surface signal-spine-x absolute right-0 z-50 mt-2 w-52 rounded-md p-2">
          <Link
            ref={itemRef}
            role="menuitem"
            tabIndex={-1}
            aria-current={pathname === "/ops" ? "page" : undefined}
            href="/ops"
            onClick={() => setOpen(false)}
            className="menu-item signal-spine-y inline-flex w-full items-center gap-2 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.09em] transition"
          >
            <IconActivity size={14} />
            Ops Dashboard
          </Link>
        </div>
      ) : null}
    </div>
  );
}
