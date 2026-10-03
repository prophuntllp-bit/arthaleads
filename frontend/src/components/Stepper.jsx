import { Check } from "lucide-react";

// Horizontal progress through a multi-step flow: done steps get a filled
// check, the current one a ringed dot, the rest a hollow dot, joined by a line
// that fills in as you go.
//
//   <Stepper current={1} steps={[{ title: "Your email", hint: "Where we reach you" }, …]} />
export default function Stepper({ steps, current, className = "" }) {
  return (
    <ol className={`grid ${className}`} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      aria-label={`Step ${current + 1} of ${steps.length}`}>
      {steps.map((s, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={s.title} className="relative flex flex-col items-center text-center" aria-current={now ? "step" : undefined}>
            {/* Line to the next step, from this dot's centre to the next one's */}
            {i < steps.length - 1 && (
              <span className="absolute left-1/2 top-[13px] h-0.5 w-full" aria-hidden="true"
                style={{ background: done ? "var(--app-primary)" : "var(--app-border-strong)" }} />
            )}
            <span className="relative z-[1] flex h-7 w-7 items-center justify-center rounded-full"
              style={done ? { background: "var(--app-primary)" }
                : now ? { background: "var(--app-primary)", boxShadow: "0 0 0 4px var(--app-surface-solid), 0 0 0 6px rgba(var(--app-primary-rgb),0.45)" }
                : { background: "var(--app-surface-solid)", border: "2px solid var(--app-border-strong)" }}>
              {done ? <Check className="h-4 w-4 text-white" strokeWidth={3} />
                : <span className="h-2 w-2 rounded-full" style={{ background: now ? "#fff" : "var(--app-border-strong)" }} />}
            </span>
            <span className="mt-2.5 px-1 text-xs font-semibold leading-tight sm:text-[13px]"
              style={{ color: now ? "var(--app-primary)" : "var(--app-text)" }}>{s.title}</span>
            {s.hint && (
              <span className="mt-0.5 hidden px-1 text-[11px] leading-tight sm:block"
                style={{ color: now ? "var(--app-primary)" : "var(--app-text-soft)", opacity: now ? 0.85 : 1 }}>{s.hint}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
