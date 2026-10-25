import React from 'react';

interface PrecisionControlProps {
  label: string;
  val: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}

export const PrecisionControl: React.FC<PrecisionControlProps> = ({
  label,
  val,
  onChange,
  min,
  max,
  step
}) => {
  const handleUpdate = (newVal: number) => {
    let bounded = Math.max(min, Math.min(max, newVal));
    const decimals = step < 1 ? 1 : 0;
    onChange(parseFloat(bounded.toFixed(decimals)));
  };

  return (
    <div className="flex flex-col gap-2 mb-4 bg-white/5 p-2 rounded border border-[var(--border)]">
      <div className="flex justify-between items-center">
        <label className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">{label}</label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleUpdate(val - step)}
          className="w-8 h-8 flex items-center justify-center bg-black/40 border border-[var(--border)] rounded text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
        >
          -
        </button>
        <div className="flex-1 relative input-wrapper shadow-inner">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={val}
            onChange={(e) => handleUpdate(parseFloat(e.target.value) || 0)}
            className="w-full bg-black/40 border border-[var(--border)] rounded h-8 text-center text-[12px] font-mono text-white focus:outline-none focus:border-[var(--accent)] transition-colors appearance-none"
          />
        </div>
        <button
          type="button"
          onClick={() => handleUpdate(val + step)}
          className="w-8 h-8 flex items-center justify-center bg-black/40 border border-[var(--border)] rounded text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
        >
          +
        </button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={val}
        onChange={(e) => handleUpdate(parseFloat(e.target.value) || 0)}
        className="w-full h-1 mt-1 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
      />
    </div>
  );
};

interface ToggleProps {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}

export const CustomToggle: React.FC<ToggleProps> = ({
  label,
  active,
  onClick,
  color = 'var(--accent)'
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full py-2 mb-2 text-[10px] font-bold uppercase border rounded flex items-center justify-between px-3 transition-colors ${
        !active ? 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--text-main)]' : ''
      }`}
      style={
        active
          ? {
              backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
              color: color,
              borderColor: color
            }
          : undefined
      }
    >
      <span>{label}</span>
      <div
        className={`w-3 h-3 rounded-full shrink-0 transition-colors ${
          !active ? 'bg-[var(--border)]' : ''
        }`}
        style={active ? { backgroundColor: color } : undefined}
      />
    </button>
  );
};
