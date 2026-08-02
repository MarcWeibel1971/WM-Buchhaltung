import { cn } from "@/lib/utils";

interface ConfidenceBarProps {
  /** 0..1 (or 0..100 if >1) */
  value: number;
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceBar({ value, showLabel = true, className }: ConfidenceBarProps) {
  const pct = Math.max(0, Math.min(100, value > 1 ? value : value * 100));
  return (
    <span className={cn("conf", className)}>
      <span className="conf-bar">
        <i style={{ width: `${pct}%` }} />
      </span>
      {showLabel && <span>{Math.round(pct)}%</span>}
    </span>
  );
}

export default ConfidenceBar;
