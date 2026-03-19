import { LocalStatus } from "../types";
import { ReactNode } from "react";

export function NavButton(props: { label: string; active: boolean; onClick: () => void; icon?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        marginBottom: 4,
        borderRadius: 8,
        border: "none",
        background: props.active ? "#1f2937" : "transparent",
        color: "#e5e7eb",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {props.icon && <span style={{ display: "flex", fontSize: 16 }}>{props.icon}</span>}
      <span>{props.label}</span>
    </button>
  );
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(15,23,42,0.9)",
        border: "1px solid #1f2937",
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#6b7280",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#e5e7eb" }}>{value}</div>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          color: "#9ca3af",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "7px 9px",
          borderRadius: 8,
          border: "1px solid #1f2937",
          background: "#020617",
          color: "#e5e7eb",
          fontSize: 13,
        }}
      />
    </div>
  );
}

export type { LocalStatus };

