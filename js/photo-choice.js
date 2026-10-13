// Pure timing state; button selections bypass the gesture entry grace.
export function createPhotoChoice(enteredAt, { holdMs = 500, graceMs = 700, timeoutMs = 12000 } = {}) {
  let held = null, since = null, selected = null;
  return {
    choose(choice) {
      if (!selected && (choice === "photo" || choice === "heart")) selected = choice;
      return selected;
    },
    update(gesture, now) {
      if (!selected && now - enteredAt >= timeoutMs) selected = "heart";
      if (now - enteredAt < graceMs || !["photo", "heart"].includes(gesture)) {
        held = since = null;
      } else if (gesture !== held) {
        held = gesture; since = now;
      }
      const progress = since == null ? 0 : Math.min(1, (now - since) / holdMs);
      if (!selected && progress >= 1) selected = held;
      return { selected, held, progress };
    },
  };
}
