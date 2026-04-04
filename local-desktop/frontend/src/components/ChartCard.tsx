import ReactECharts from "echarts-for-react";
import { EChartsOption } from "echarts";
import { applyCjkChartFonts } from "./chartCjkFont";

interface Props {
  title: string;
  option: EChartsOption;
  height?: number;
  loading?: boolean;
}

export function ChartCard({ title, option, height = 300, loading = false }: Props) {
  const patchedOption = applyCjkChartFonts(option);
  return (
    <div
      style={{
        background: "var(--panel-bg2)",
        borderRadius: 12,
        padding: "16px 20px",
        border: "none",
        boxShadow: "none",
        minWidth: 0,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--fg)",
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
            background: "linear-gradient(90deg, var(--panel-bg2) 25%, var(--panel-bg) 50%, var(--panel-bg2) 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
            borderRadius: 8,
          }}
        />
      ) : (
        <ReactECharts option={option} style={{ height, width: "100%" }} opts={{ renderer: "canvas" }} />
      )}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
