import type { ReactNode } from "react";
import "./exchanges.css";

export default function ExchangesLayout({ children }: { children: ReactNode }) {
  return <div className="exchange-experience">{children}</div>;
}
