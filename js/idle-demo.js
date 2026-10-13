export function createIdleDemo(delay = 30000) {
  let since = 0;
  return {
    reset(now) { since = now; },
    visible({ now, landing, handDetected }) {
      if (!landing || handDetected) { since = now; return false; }
      return now - since >= delay;
    },
  };
}
