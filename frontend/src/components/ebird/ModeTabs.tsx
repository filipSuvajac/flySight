import type { EbirdMode } from "./ebirdTypes";

type ModeTabsProps = {
  mode: EbirdMode;
  onChange: (mode: EbirdMode) => void;
};

const modes: Array<{ mode: EbirdMode; label: string }> = [
  { mode: "recent", label: "Recent observations" },
  { mode: "hotspots", label: "All-time hotspots" }
];

export function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div className="mode-tabs">
      {modes.map((item) => (
        <button
          className={mode === item.mode ? "active" : ""}
          key={item.mode}
          onClick={() => onChange(item.mode)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

