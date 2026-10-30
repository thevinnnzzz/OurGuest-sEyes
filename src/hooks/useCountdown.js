import { useEffect, useState } from 'react';

function computeRemaining(deadlineIso) {
  const total = Math.max(0, new Date(deadlineIso).getTime() - Date.now());
  const totalSeconds = Math.floor(total / 1000);
  return {
    total,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: total <= 0,
  };
}

export function useCountdown(deadlineIso) {
  const [remaining, setRemaining] = useState(() => computeRemaining(deadlineIso));

  useEffect(() => {
    if (!deadlineIso) return undefined;
    setRemaining(computeRemaining(deadlineIso));
    const t = setInterval(() => setRemaining(computeRemaining(deadlineIso)), 1000);
    return () => clearInterval(t);
  }, [deadlineIso]);

  return remaining;
}
