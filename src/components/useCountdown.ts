"use client";

import { useEffect, useState } from "react";

export function useCountdown(endsAt: number | null): number {
  const [remaining, setRemaining] = useState(() => (endsAt ? Math.max(0, endsAt - Date.now()) : 0));

  useEffect(() => {
    if (!endsAt) {
      setRemaining(0);
      return;
    }
    setRemaining(Math.max(0, endsAt - Date.now()));
    const id = setInterval(() => {
      setRemaining(Math.max(0, endsAt - Date.now()));
    }, 100);
    return () => clearInterval(id);
  }, [endsAt]);

  return remaining;
}
