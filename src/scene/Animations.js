export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

export class Animations {
  constructor() {
    this.items = [];
  }

  add({ duration = 300, delay = 0, ease = easeOutCubic, onUpdate, onComplete, tag = null }) {
    const now = performance.now();
    return new Promise((resolve) => {
      if (duration <= 0) {
        onUpdate?.(1, 1);
        onComplete?.();
        resolve();
        return;
      }
      const item = {
        start: now + delay,
        duration,
        ease,
        onUpdate,
        onComplete,
        tag,
        resolve,
        cancelled: false,
      };
      this.items.push(item);
    });
  }

  cancelTag(tag) {
    for (const item of this.items) {
      if (item.tag === tag) {
        item.cancelled = true;
        item.resolve();
      }
    }
    this.items = this.items.filter((item) => !item.cancelled);
  }

  update(now = performance.now()) {
    if (this.items.length === 0) return;
    const remaining = [];
    for (const item of this.items) {
      if (item.cancelled) continue;
      if (now < item.start) {
        remaining.push(item);
        continue;
      }
      const raw = Math.min(1, (now - item.start) / item.duration);
      const eased = item.ease(raw);
      item.onUpdate?.(raw, eased);
      if (raw >= 1) {
        item.onComplete?.(eased);
        item.resolve();
      } else {
        remaining.push(item);
      }
    }
    this.items = remaining;
  }
}
