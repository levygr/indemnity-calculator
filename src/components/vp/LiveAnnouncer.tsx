import { useEffect, useRef, useState } from "react";

/**
 * Région ARIA-live discrète, annonçant un message aux lecteurs d'écran
 * avec un debounce pour éviter de vocaliser chaque frappe.
 */
export function LiveAnnouncer({
  message,
  delay = 800,
  politeness = "polite",
}: {
  message: string;
  delay?: number;
  politeness?: "polite" | "assertive";
}) {
  const [announced, setAnnounced] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAnnounced(message), delay);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [message, delay]);

  return (
    <div role="status" aria-live={politeness} aria-atomic="true" className="sr-only">
      {announced}
    </div>
  );
}
