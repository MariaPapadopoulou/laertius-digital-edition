import { useEffect, useRef, useState } from "react";

/**
 * Counts up from 1 to `value` with an ease-out cubic curve, matching the
 * hero counters of the Humanistica Digitalia editions: the animation
 * starts when the element scrolls into view, the final width is reserved
 * up front so the layout never reflows while digits are appended, and
 * users with prefers-reduced-motion see the final value immediately.
 * Value changes during or after the animation are picked up on the next
 * frame instead of being clobbered.
 */
export function CountUp({
  value,
  duration = 1600,
}: {
  value: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(1);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  const finished = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  // After the animation has run (or been skipped), later value changes
  // (e.g. a stats refetch) apply immediately.
  useEffect(() => {
    if (finished.current) setDisplay(value);
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el || started.current) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      started.current = true;
      finished.current = true;
      setDisplay(valueRef.current);
      return;
    }

    let frame = 0;
    const run = () => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        // Re-read the target each frame so external updates can change it
        // mid-animation.
        setDisplay(Math.max(1, Math.round(valueRef.current * eased)));
        if (t < 1) {
          frame = requestAnimationFrame(tick);
        } else {
          finished.current = true;
          setDisplay(valueRef.current);
        }
      };
      frame = requestAnimationFrame(tick);
    };

    // Trigger when the counter enters the viewport (immediately on load
    // for the hero, but also handles deep-link scrolls into the page).
    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries, obs) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              obs.disconnect();
              run();
              return;
            }
          }
        },
        { threshold: 0.2 },
      );
      io.observe(el);
    } else {
      run();
    }

    return () => {
      io?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [duration]);

  // Reserve the width of the final value (invisible twin) so the layout
  // doesn't reflow as digits are appended; the live value sits on top,
  // centered, exactly like the reference implementation.
  return (
    <span ref={ref} className="relative inline-block whitespace-nowrap">
      <span className="invisible">{value.toLocaleString("en-US")}</span>
      <span className="absolute inset-0 text-center">
        {display.toLocaleString("en-US")}
      </span>
    </span>
  );
}
