/* eslint-disable @next/next/no-img-element */
"use client";

import { cn } from "@/lib/utils";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import React, { useState } from "react";

interface NavbarProps {
  children: React.ReactNode;
  className?: string;
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface NavItemsProps {
  items: {
    name: string;
    link: string;
  }[];
  className?: string;
  onItemClick?: () => void;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose?: () => void;
}

export const Navbar = ({ children, className }: NavbarProps) => {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setVisible(latest > 64);
  });

  return (
    <div className={cn("sticky inset-x-0 top-0 z-40 w-full", className)}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ visible?: boolean }>, {
              visible,
            })
          : child,
      )}
    </div>
  );
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
  return (
    <motion.div
      animate={{
        y: visible ? 6 : 0,
        scale: visible ? 0.985 : 1,
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 30,
      }}
      className={cn(
        "relative z-[60] mx-auto hidden w-full max-w-7xl items-center justify-between px-4 lg:flex",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  return (
    <div className={cn("hidden items-center gap-2 lg:flex", className)}>
      {items.map((item) => (
        <a key={item.link} onClick={onItemClick} href={item.link} className="button-ghost rounded-md px-3 py-2 text-xs uppercase tracking-[0.09em]">
          {item.name}
        </a>
      ))}
    </div>
  );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  return (
    <motion.div
      animate={{
        y: visible ? 6 : 0,
        scale: visible ? 0.99 : 1,
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 30,
      }}
      className={cn("relative z-50 mx-auto flex w-full max-w-[calc(100vw-1rem)] flex-col px-0 py-1 lg:hidden", className)}
    >
      {children}
    </motion.div>
  );
};

export const MobileNavHeader = ({ children, className }: MobileNavHeaderProps) => {
  return <div className={cn("flex w-full items-center justify-between", className)}>{children}</div>;
};

export const MobileNavMenu = ({ children, className, isOpen, onClose }: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="mobile-nav-panel"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          onClick={onClose}
          className={cn("absolute inset-x-0 top-[3.75rem] z-50 flex w-full flex-col items-start justify-start gap-3", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick?: () => void;
}) => {
  return isOpen ? <IconX className="text-[var(--text-primary)]" onClick={onClick} /> : <IconMenu2 className="text-[var(--text-primary)]" onClick={onClick} />;
};

export const NavbarLogo = () => {
  return (
    <a href="#" className="relative z-20 mr-4 flex items-center space-x-2 px-2 py-1 text-sm font-normal text-black">
      <img src="https://assets.aceternity.com/logo-dark.png" alt="logo" width={30} height={30} />
      <span className="font-medium text-black dark:text-white">Startup</span>
    </a>
  );
};

export const NavbarButton = ({
  href,
  as: Tag = "a",
  children,
  className,
  variant = "primary",
  ...props
}: {
  href?: string;
  as?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "dark" | "gradient";
} & (React.ComponentPropsWithoutRef<"a"> | React.ComponentPropsWithoutRef<"button">)) => {
  const variantStyles = {
    primary: "button-primary",
    secondary: "button-secondary",
    dark: "button-ghost",
    gradient: "button-primary",
  };

  return (
    <Tag href={href || undefined} className={cn("rounded-md px-4 py-2 text-xs uppercase tracking-[0.09em]", variantStyles[variant], className)} {...props}>
      {children}
    </Tag>
  );
};
