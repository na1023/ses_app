import { monthWorkLevel } from "@/lib/constants";

export default function WorkBalanceCard({
  overtime,
  maxRun,
  label = "今月のワークバランス",
}: {
  overtime: number;
  maxRun: number;
  label?: string;
}) {
  const level = monthWorkLevel(overtime, maxRun);
  return (
    <div className="card" style={{ background: level.color + "12", borderColor: level.color }}>
      <div className="text-xs" style={{ color: "var(--subtle)" }}>{label}</div>
      <div className="mt-1 flex items-center justify-between">
        <div className="text-2xl font-extrabold" style={{ color: level.color }}>
          {level.emoji} {level.label}
        </div>
        <div className="text-right text-xs" style={{ color: "var(--muted)" }}>
          残業 {overtime.toFixed(2)}h<br />最大連続 {maxRun}日
        </div>
      </div>
    </div>
  );
}
