import type { LucideIcon } from "lucide-react";

type SettingsNavigationItem<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
};

type SettingsNavigationProps<T extends string> = {
  items: readonly SettingsNavigationItem<T>[];
  activeItem: T;
  onSelect: (item: T) => void;
};

export function SettingsNavigation<T extends string>({ items, activeItem, onSelect }: SettingsNavigationProps<T>) {
  return (
    <aside className="w-56 border-r bg-muted/30 p-4 flex flex-col gap-1 shrink-0">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
        Einstellungen
      </h2>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left ${
              activeItem === item.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </button>
        );
      })}
    </aside>
  );
}
