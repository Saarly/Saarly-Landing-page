import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { statusLabel, statusTone } from "@/components/merchant/portal-utils";

export function PortalPanel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`portal-panel ${className}`}>
      <header className="portal-panel-head">
        <div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
        {action ? <div className="portal-panel-action">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function StatusBadge({ value, locale }: { value: unknown; locale: "ar" | "en" }) {
  return <span className={`status-badge ${statusTone(value)}`}>{statusLabel(value, locale)}</span>;
}

export function EmptyState({ icon = "box", title, body, action }: { icon?: Parameters<typeof Icon>[0]["name"]; title: string; body: string; action?: ReactNode }) {
  return <div className="portal-empty"><span><Icon name={icon} size={26}/></span><h3>{title}</h3><p>{body}</p>{action}</div>;
}

export function MetricCard({ icon, label, value, note, tone = "green" }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: ReactNode; note?: string; tone?: "green" | "blue" | "gold" | "gray" }) {
  return <article className={`metric-card ${tone}`}><span className="metric-icon"><Icon name={icon}/></span><div><p>{label}</p><strong>{value}</strong>{note ? <small>{note}</small> : null}</div></article>;
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "success" | "warning" | "danger"; title?: string; children: ReactNode }) {
  return <div className={`portal-notice ${tone}`}><Icon name={tone === "danger" ? "info" : tone === "success" ? "check" : "info"}/><div>{title ? <strong>{title}</strong> : null}<p>{children}</p></div></div>;
}

export function LoadingBlock({ label }: { label: string }) {
  return <div className="portal-loading"><span className="spinner"/><strong>{label}</strong></div>;
}
