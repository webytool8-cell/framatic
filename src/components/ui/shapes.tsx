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

/**
 * Framatic logo: the filmstrip-and-spark mark (coral) with the wordmark in heavy, wide Archivo.
 * `mono` uses the black mark, for the rare places where color would clash (e.g. the footer).
 */
export function Logo({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, no optimisation needed */}
      <img src={mono ? "/logo-black.svg" : "/logo.svg"} alt="" aria-hidden width={25} height={28} className="h-7 w-auto" />
      <span className="text-[20px] leading-none tracking-[-0.02em]" style={{ fontWeight: 800, fontStretch: "112%" }}>framatic</span>
    </span>
  );
}

/** The curved four-point spark from the logo, as a decorative accent. */
export function Spark({ className, color = "#7957FF", twinkle = false, delay = 0, style }: { className?: string; color?: string; twinkle?: boolean; delay?: number; style?: React.CSSProperties }) {
  return (
    <svg
      aria-hidden
      viewBox="133.9 169.5 232.2 232"
      className={cn("pointer-events-none select-none", twinkle && "animate-twinkle", className)}
      style={{ animationDelay: delay ? `${delay}ms` : undefined, ...style }}
    >
      <path
        d="M250 169.516C258.929 169.516 256.696 225.277 285.714 249.812C312.5 274.348 366.071 276.578 366.071 285.5C366.071 294.422 312.5 296.652 285.714 321.188C256.696 345.723 258.929 401.484 250 401.484C241.071 401.484 243.304 345.723 214.286 321.188C187.5 296.652 133.929 294.422 133.929 285.5C133.929 276.578 187.5 274.348 214.286 249.812C243.304 225.277 241.071 169.516 250 169.516Z"
        fill={color}
      />
    </svg>
  );
}
