import ReactECharts from "echarts-for-react";
import { EChartsOption } from "echarts";

interface Props {
  title: string;
  option: EChartsOption;
  height?: number;
  loading?: boolean;
}

export function ChartCard({ title, option, height = 300, loading = false }: Props) {
  return (
    <div
      style={{
        background: "#0f172a",
        borderRadius: 12,
        padding: "16px 20px",
        border: "1px solid #1e293b",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        minWidth: 0,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#f1f5f9",
            marginBottom: 12,
          }}
        >
          {title}
        </div>
      )}
      {loading ? (
        <div
          style={{
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
            fontSize: 12,
          }}
        >
          加载中...
        </div>
      ) : (
        <ReactECharts option={option} style={{ height, width: "100%" }} opts={{ renderer: "canvas" }} />
      )}
    </div>
  );
}
