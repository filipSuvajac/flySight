import { useMemo, type ReactNode } from "react";
import type { EbirdObservation } from "../../types";

type ObservationChartsProps = {
  observations: EbirdObservation[];
};

type ChartDatum = {
  label: string;
  value: number;
};

const chartColors = ["#0f766e", "#2563eb", "#ca8a04", "#dc2626", "#7c3aed", "#0891b2"];

export function ObservationCharts({ observations }: ObservationChartsProps) {
  const speciesData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const observation of observations) {
      const label = observation.slovenianName || observation.commonName || observation.speciesCode || "Unknown";
      totals.set(label, (totals.get(label) ?? 0) + observationCount(observation));
    }
    return topEntries(totals, 6);
  }, [observations]);

  const timelineData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const observation of observations) {
      const label = observation.observedAt.slice(0, 10) || "Unknown";
      totals.set(label, (totals.get(label) ?? 0) + 1);
    }
    return Array.from(totals.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, value]) => ({ label: shortDate(label), value }));
  }, [observations]);

  const locationData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const observation of observations) {
      const label = observation.city || observation.locationName || "Unknown";
      totals.set(label, (totals.get(label) ?? 0) + 1);
    }
    return topEntries(totals, 5);
  }, [observations]);

  return (
    <section className="analytics-grid" aria-label="Observation analytics">
      <ChartPanel title="Observations by species" value={`${observations.length} filtered`}>
        <BarChart data={speciesData} />
      </ChartPanel>
      <ChartPanel title="Observations over time" value={`${timelineData.length} dates`}>
        <LineChart data={timelineData} />
      </ChartPanel>
      <ChartPanel title="Top locations" value={`${locationData.length} shown`}>
        <HorizontalBars data={locationData} />
      </ChartPanel>
    </section>
  );
}

function ChartPanel({ title, value, children }: { title: string; value: string; children: ReactNode }) {
  return (
    <article className="analytics-card">
      <div className="analytics-card-heading">
        <h3>{title}</h3>
        <span>{value}</span>
      </div>
      {children}
    </article>
  );
}

function BarChart({ data }: { data: ChartDatum[] }) {
  if (data.length === 0) return <EmptyChart />;

  const width = 360;
  const height = 190;
  const padding = 28;
  const gap = 10;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const barWidth = (width - padding * 2 - gap * (data.length - 1)) / data.length;

  return (
    <svg className="analytics-chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <title>Bar chart of observations by species</title>
      <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
      {data.map((item, index) => {
        const barHeight = ((height - padding * 2) * item.value) / maxValue;
        const x = padding + index * (barWidth + gap);
        const y = height - padding - barHeight;

        return (
          <g key={item.label}>
            <rect
              fill={chartColors[index % chartColors.length]}
              height={barHeight}
              rx="5"
              width={barWidth}
              x={x}
              y={y}
            />
            <text x={x + barWidth / 2} y={y - 7} textAnchor="middle">{item.value}</text>
            <text className="chart-label" x={x + barWidth / 2} y={height - 8} textAnchor="middle">
              {compactLabel(item.label)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data }: { data: ChartDatum[] }) {
  if (data.length === 0) return <EmptyChart />;

  const width = 360;
  const height = 190;
  const padding = 28;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const points = data.map((item, index) => {
    const x = data.length === 1
      ? width / 2
      : padding + (index * (width - padding * 2)) / (data.length - 1);
    const y = height - padding - ((height - padding * 2) * item.value) / maxValue;
    return { ...item, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <svg className="analytics-chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <title>Line chart of observations over time</title>
      <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
      <path className="timeline-line" d={path} />
      {points.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          <circle cx={point.x} cy={point.y} r="4" />
          {(index === 0 || index === points.length - 1) && (
            <text className="chart-label" x={point.x} y={height - 8} textAnchor="middle">
              {point.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function HorizontalBars({ data }: { data: ChartDatum[] }) {
  if (data.length === 0) return <EmptyChart />;

  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="location-bars">
      {data.map((item, index) => (
        <div className="location-bar-row" key={item.label}>
          <span>{item.label}</span>
          <div className="location-bar-track">
            <div
              className="location-bar-fill"
              style={{
                background: chartColors[index % chartColors.length],
                width: `${Math.max((item.value / maxValue) * 100, 8)}%`
              }}
            />
          </div>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function EmptyChart() {
  return <div className="empty-chart">No observations match the current filters.</div>;
}

function topEntries(entries: Map<string, number>, limit: number): ChartDatum[] {
  return Array.from(entries.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

function observationCount(observation: EbirdObservation) {
  return observation.count && observation.count > 0 ? observation.count : 1;
}

function compactLabel(label: string) {
  return label.length > 12 ? `${label.slice(0, 11)}.` : label;
}

function shortDate(value: string) {
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : value;
}
