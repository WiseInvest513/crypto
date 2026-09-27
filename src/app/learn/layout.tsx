import type { ReactNode } from "react";
import "./learn.css";

export default function LearnLayout({ children }: { children: ReactNode }) {
  return <div className="learn-experience">{children}</div>;
}
