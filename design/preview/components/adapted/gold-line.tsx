"use client";
// Adapted from 21st "Line Charts 9" by sean0205 — https://21st.dev/@sean0205/components/line-charts-9
// Chart block kept (recharts ComposedChart, dot grid, dashed reference line, drop-shadowed line);
// purple → var(--gold), data + tick format as props, header removed (host renders its own).
import { ChartConfig, ChartContainer } from "@/components/ui/line-charts-9";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";

export function GoldLine({ data, marker, height = 220, fmt = (v: number) => `$${v.toLocaleString()}` }: { data: { date: string; value: number }[]; marker?: string; height?: number; fmt?: (v: number) => string }) {
  const chartConfig = { value: { label: "Balance", color: "var(--gold)" } } satisfies ChartConfig;
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
      <ComposedChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 8 }}>
        <defs>
          <pattern id="dotGrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1" fill="var(--input)" fillOpacity="0.5" />
          </pattern>
          <filter id="dotShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.35)" />
          </filter>
          <filter id="lineShadow" x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="2" dy="6" stdDeviation="14" floodColor="rgba(184,137,43,0.55)" />
          </filter>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#dotGrid)" style={{ pointerEvents: "none" }} />
        <CartesianGrid strokeDasharray="4 8" stroke="var(--input)" strokeOpacity={1} horizontal vertical={false} />
        {marker && <ReferenceLine x={marker} stroke={chartConfig.value.color} strokeDasharray="4 4" strokeWidth={1} />}
        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickMargin={10} interval="preserveStartEnd" />
        <YAxis axisLine={false} tickLine={false} width={56} domain={["dataMin - 50", "dataMax + 50"]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={fmt} tickMargin={6} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={chartConfig.value.color}
          strokeWidth={2}
          filter="url(#lineShadow)"
          isAnimationActive={false}
          dot={(props: { cx?: number; cy?: number; payload: { date: string; value: number } }) => {
            const { cx, cy, payload } = props;
            if (payload.date === marker || payload.value === max || payload.value === min)
              return <circle key={`dot-${payload.date}`} cx={cx} cy={cy} r={5} fill={chartConfig.value.color} stroke="white" strokeWidth={2} filter="url(#dotShadow)" />;
            return <g key={`dot-${payload.date}`} />;
          }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
