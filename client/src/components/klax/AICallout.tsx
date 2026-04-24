import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AICalloutProps {
  children: ReactNode;
  title?: string;
  icon?: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function AICallout({ children, title, icon, className, action }: AICalloutProps) {
  return (
    <div className={cn("ai-callout flex gap-3", className)}>
      <div
        className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
        style={{ background: "var(--ai)", color: "#fff" }}
      >
        {icon ?? <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        {title && (
          <div
            className="text-[10.5px] uppercase tracking-wider font-semibold mb-1"
            style={{ color: "var(--ai)" }}
          >
            {title}
          </div>
        )}
        <div className="text-[13px]" style={{ color: "var(--ink)" }}>
          {children}
        </div>
      </div>
      {action && <div className="flex-shrink-0 self-center">{action}</div>}
    </div>
  );
}

export default AICallout;
