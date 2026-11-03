export class ChessClock extends EventTarget {
  constructor() {
    super();
    this.initial = 0;
    this.increment = 0;
    this.remaining = { w: 0, b: 0 };
    this.active = 'w';
    this.running = false;
    this.lastTick = 0;
    this.interval = null;
  }

  configure(initialSeconds, incrementSeconds) {
    this.stop();
    this.initial = Math.max(0, initialSeconds) * 1000;
    this.increment = Math.max(0, incrementSeconds) * 1000;
    this.remaining = { w: this.initial, b: this.initial };
    this.active = 'w';
    this.emitChange();
  }

  emitChange() {
    this.dispatchEvent(
      new CustomEvent('change', {
        detail: {
          w: this.remaining.w,
          b: this.remaining.b,
          active: this.running ? this.active : null,
          initial: this.initial,
        },
      }),
    );
  }

  start() {
    if (this.initial <= 0) return;
    if (this.running) return;
    this.running = true;
    this.lastTick = performance.now();
    clearInterval(this.interval);
    this.interval = setInterval(() => this.tick(), 100);
    this.emitChange();
  }

  pause() {
    if (!this.running) return;
    this.tick();
    this.running = false;
    clearInterval(this.interval);
    this.interval = null;
    this.emitChange();
  }

  resume() {
    if (this.initial <= 0 || this.running) return;
    this.start();
  }

  stop() {
    this.running = false;
    clearInterval(this.interval);
    this.interval = null;
    this.emitChange();
  }

  setActive(color, { start = false } = {}) {
    this.active = color;
    this.lastTick = performance.now();
    if (start) this.start();
    this.emitChange();
  }

  completeMove(color) {
    if (this.initial <= 0) return;
    this.remaining[color] = Math.max(0, this.remaining[color] + this.increment);
    this.active = color === 'w' ? 'b' : 'w';
    this.lastTick = performance.now();
    this.emitChange();
  }

  addTo(color, milliseconds) {
    if (this.initial <= 0) return;
    this.remaining[color] = Math.max(0, this.remaining[color] + milliseconds);
    this.emitChange();
  }

  tick() {
    if (!this.running || this.initial <= 0) return;
    const now = performance.now();
    const elapsed = Math.max(0, now - this.lastTick);
    this.lastTick = now;
    const color = this.active;
    this.remaining[color] = Math.max(0, this.remaining[color] - elapsed);
    if (this.remaining[color] <= 0) {
      this.remaining[color] = 0;
      this.running = false;
      clearInterval(this.interval);
      this.interval = null;
      this.emitChange();
      this.dispatchEvent(new CustomEvent('timeout', { detail: { color } }));
      return;
    }
    this.emitChange();
  }
}
