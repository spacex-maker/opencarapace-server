import { LocalStatus } from "./Common";
import { StatCard } from "./Common";

export function LocalManagePanel({ status }: { status: LocalStatus | null }) {
  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        background: "#020617",
        borderRadius: 16,
        padding: "24px 28px",
        border: "1px solid #1f2937",
        boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
      }}
    >
      <h1 style={{ fontSize: 20, margin: "0 0 4px", color: "#f9fafb" }}>本地管理</h1>
      <p style={{ margin: "4px 0 16px", fontSize: 13, color: "#9ca3af" }}>
        查看本地数据库中已同步的规则与配置概况（后续可以扩展为表级管理与调试视图）。
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0,1fr))",
          gap: 12,
        }}
      >
        <StatCard label="危险指令规则（danger_commands）" value={status?.danger ?? 0} />
        <StatCard label="系统禁用技能（disabled_skills）" value={status?.disabled ?? 0} />
        <StatCard label="系统不推荐技能（deprecated_skills）" value={status?.deprecated ?? 0} />
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
        <div>· 数据库文件路径：~/.clawheart/local-client.db</div>
        <div>· 表结构：danger_commands / disabled_skills / deprecated_skills / user_skills / local_settings</div>
        <div>· 后续可以在这里增加：按表浏览、导出、清理以及本地命中日志查看。</div>
      </div>
    </div>
  );
}

