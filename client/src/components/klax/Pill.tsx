import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type PillVariant = "default" | "accent" | "ai" | "pos" | "warn" | "neg" | "info";

interface PillProps {
  children: ReactNode;
  variant?: PillVariant;
  icon?: ReactNode;
  className?: string;
}

export function Pill({ children, variant = "default", icon, className }: PillProps) {
  const variantClass: Record<PillVariant, string> = {
    default: "",
    accent: "pill--accent",
    ai: "pill--ai",
    pos: "pill--pos",
    warn: "pill--warn",
    neg: "pill--neg",
    info: "pill--info",
  };
  return (
    <span className={cn("pill", variantClass[variant], className)}>
      {icon}
      {children}
    </span>
  );
}

export default Pill;
