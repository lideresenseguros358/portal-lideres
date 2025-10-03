type ActivityCallback = () => void;

type ListenerCleanup = () => void;

export function createSessionTimeout(minutes: number, onTimeout: ActivityCallback) {
  if (minutes <= 0) throw new Error("minutes must be greater than 0");
  if (!onTimeout) throw new Error("onTimeout callback is required");

  const timeoutMs = minutes * 60_000;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const resetTimer = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      onTimeout();
    }, timeoutMs);
  };

  const activityHandler = () => {
    resetTimer();
  };

  const attach = (): ListenerCleanup => {
    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "touchstart", "click"];
    events.forEach((event) => window.addEventListener(event, activityHandler, { passive: true }));
    resetTimer();

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      events.forEach((event) => window.removeEventListener(event, activityHandler));
    };
  };

  return {
    start: attach,
    reset: resetTimer,
  };
}
