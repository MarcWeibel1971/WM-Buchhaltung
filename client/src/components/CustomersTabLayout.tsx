import type { ReactNode } from "react";

export function CustomersTabLayout({ toolbar, children }: { toolbar: ReactNode; children: ReactNode }) {
  return <div className="space-y-6">{toolbar}{children}</div>;
}
