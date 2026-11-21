import React from 'react';
import { soundEngine } from '../game/sound';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'accent';
  size?: 'sm' | 'md' | 'lg';
}

export const ArcadeButton: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  onClick,
  onMouseEnter,
  disabled,
  ...rest
}) => {
  const sizeCls =
    size === 'lg'
      ? 'px-7 py-3.5 text-lg rounded-[20px]'
      : size === 'sm'
      ? 'px-3.5 py-1.5 text-sm rounded-[14px]'
      : 'px-5 py-2.5 text-base rounded-[16px]';

  const varCls =
    variant === 'primary'
      ? 'bg-gradient-to-br from-[#7C5CFF] to-[#00B8FF] text-white shadow-[0_6px_22px_rgba(124,92,255,0.42)] hover:shadow-[0_10px_28px_rgba(0,184,255,0.5)]'
      : variant === 'accent'
      ? 'bg-[#00E5C3] text-[#0A0F25] font-bold shadow-[0_6px_20px_rgba(0,229,195,0.38)]'
      : variant === 'gold'
      ? 'bg-gradient-to-br from-[#FFC83D] to-[#FF8A00] text-[#0A0F25] font-bold shadow-[0_6px_20px_rgba(255,200,61,0.35)]'
      : variant === 'danger'
      ? 'bg-[#FF4D6D] text-white shadow-[0_6px_18px_rgba(255,77,109,0.35)]'
      : variant === 'secondary'
      ? 'bg-white/10 border border-white/18 text-[#F5F7FF] hover:bg-white/15'
      : 'bg-transparent border border-white/12 text-[#AAB3DE] hover:text-white hover:bg-white/8';

  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled) soundEngine.playUiHover();
        onMouseEnter?.(e);
      }}
      onClick={(e) => {
        soundEngine.unlock();
        if (!disabled) soundEngine.playUiClick();
        onClick?.(e);
      }}
      className={`btn-arcade inline-flex items-center justify-center gap-2 font-display font-semibold tracking-wide cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${sizeCls} ${varCls} ${className}`}
    >
      {children}
    </button>
  );
};

export const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`glass-panel rounded-[24px] p-5 ${className}`}>{children}</div>
);

export const StatBar: React.FC<{
  label: string;
  value: number; // 0..100
  color?: string;
}> = ({ label, value, color = '#00E5C3' }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-16 text-[#AAB3DE] font-semibold shrink-0">{label}</span>
    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-[width] duration-200 ease-out"
        style={{ width: `${Math.max(8, Math.min(100, value))}%`, background: color }}
      />
    </div>
    <span className="w-7 text-right font-mono-num text-[#F5F7FF]">{value}</span>
  </div>
);

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (val: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-1 p-1 rounded-[14px] bg-black/30 border border-white/12"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={disabled}
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playUiClick();
              onChange(opt.value);
            }}
            className={`px-3 py-1 rounded-[10px] text-xs font-display font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              active
                ? 'bg-[#00E5C3] text-[#0A0F25] shadow-sm'
                : 'text-[#AAB3DE] hover:text-white hover:bg-white/8'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export const ArcadeSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, step = 1, suffix = '', onChange }) => (
  <label className="flex flex-col gap-1.5 text-sm">
    <div className="flex items-center justify-between">
      <span className="text-[#F5F7FF] font-semibold">{label}</span>
      <span className="font-mono-num text-[#00E5C3] font-bold">
        {Number.isInteger(step) ? value : value.toFixed(2)}
        {suffix}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[#00E5C3] cursor-pointer"
    />
  </label>
);

export const ArcadeToggle: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, description, checked, disabled = false, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => {
      soundEngine.unlock();
      soundEngine.playUiClick();
      onChange(!checked);
    }}
    className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-[14px] bg-white/5 hover:bg-white/8 border border-white/10 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <div>
      <div className="text-sm font-semibold text-[#F5F7FF]">{label}</div>
      {description && <div className="text-xs text-[#AAB3DE]">{description}</div>}
    </div>
    <div
      className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
        checked ? 'bg-[#00E5C3]' : 'bg-white/20'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-150 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </div>
  </button>
);

export const Modal: React.FC<{
  open: boolean;
  title: string;
  onClose?: () => void;
  maxWidth?: string;
  children: React.ReactNode;
}> = ({ open, title, onClose, maxWidth = 'max-w-3xl', children }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`hud-panel anim-screen-enter w-full ${maxWidth} max-h-[90vh] flex flex-col rounded-[28px] overflow-hidden`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/12">
          <h2 className="font-display text-2xl font-bold text-[#F5F7FF] tracking-wide">{title}</h2>
          {onClose && (
            <ArcadeButton variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog">
              Close
            </ArcadeButton>
          )}
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

export interface ToastItem {
  id: number;
  text: string;
  tone?: 'info' | 'warn' | 'accent';
}

export const ToastStack: React.FC<{ toasts: ToastItem[] }> = ({ toasts }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`hud-panel anim-screen-enter px-5 py-2.5 rounded-full font-display font-semibold text-sm border ${
            t.tone === 'warn'
              ? 'border-[#FF4D6D]/60 text-[#FF4D6D]'
              : t.tone === 'accent'
              ? 'border-[#00E5C3]/60 text-[#00E5C3]'
              : 'border-white/20 text-[#F5F7FF]'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
};
