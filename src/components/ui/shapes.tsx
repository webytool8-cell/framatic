import { cn } from "@/lib/cn";

/* Simple geometric motifs reused across the product. All decorative → aria-hidden. */

export function Circle({ className, color = "#7957FF" }: { className?: string; color?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className={className}>
      <circle cx="50" cy="50" r="50" fill={color} />
    </svg>
  );
}

export function Ring({ className, color = "#39C6E8", stroke = 10 }: { className?: string; color?: string; stroke?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className={className}>
      <circle cx="50" cy="50" r={50 - stroke / 2} fill="none" stroke={color} strokeWidth={stroke} />
    </svg>
  );
}

export function Arc({ className, color = "#FF6B6B", stroke = 12 }: { className?: string; color?: string; stroke?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 100 50" className={className}>
      <path d={`M ${stroke / 2} 50 A ${50 - stroke / 2} ${50 - stroke / 2} 0 0 1 ${100 - stroke / 2} 50`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  );
}

export function Pill({ className, color = "#C5F467" }: { className?: string; color?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 120 40" className={className}>
      <rect width="120" height="40" rx="20" fill={color} />
    </svg>
  );
}

export function HalfDisc({ className, color = "#FFD166" }: { className?: string; color?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 100 50" className={className}>
      <path d="M0 50 A50 50 0 0 1 100 50 Z" fill={color} />
    </svg>
  );
}

export function Plus({ className, color = "#202124" }: { className?: string; color?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className}>
      <path d="M12 3v18M3 12h18" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Dots({ className, color = "#202124" }: { className?: string; color?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 60 36" className={className}>
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3, 4].map((c) => <circle key={`${r}${c}`} cx={6 + c * 12} cy={6 + r * 12} r="2.4" fill={color} />),
      )}
    </svg>
  );
}

/** Framatic wordmark: a "frame" built from four geometric pieces. */
export function Logo({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight text-ink", className)}>
      <svg aria-hidden viewBox="0 0 32 32" className="h-7 w-7">
        <rect x="2" y="2" width="13" height="13" rx="3" fill={mono ? "#202124" : "#7957FF"} />
        <circle cx="23.5" cy="8.5" r="6.5" fill={mono ? "#202124" : "#FF6B6B"} />
        <path d="M2 30 A13 13 0 0 1 15 17 L15 30 Z" fill={mono ? "#202124" : "#39C6E8"} />
        <rect x="17" y="17" width="13" height="13" rx="6.5" fill={mono ? "#202124" : "#C5F467"} />
      </svg>
      <span className="text-[19px]">framatic</span>
    </span>
  );
}
