import type { ReactNode } from "react";
import "./tools.css";

export default function ToolsLayout({ children }: { children: ReactNode }) {
  return <div className="tools-experience">{children}</div>;
}
