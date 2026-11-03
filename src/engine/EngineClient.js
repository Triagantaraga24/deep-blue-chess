export class EngineClient {
  constructor(name = 'engine') {
    this.name = name;
    this.worker = null;
    this.requestId = 0;
    this.pending = new Map();
    this.spawn();
  }

  spawn() {
    if (this.worker) {
      this.worker.terminate();
    }
    this.worker = new Worker(new URL('./engine.worker.js', import.meta.url), {
      type: 'module',
      name: `deep-blue-${this.name}`,
    });
    this.worker.onmessage = (event) => this.handleMessage(event.data);
    this.worker.onerror = (event) => {
      console.error('Engine worker error', event.message);
      this.failPending(new Error('Engine worker crashed'));
      this.spawn();
    };
    this.worker.onmessageerror = () => {
      this.failPending(new Error('Engine worker message error'));
    };
  }

  failPending(error) {
    for (const entry of this.pending.values()) {
      entry.reject(error);
    }
    this.pending.clear();
  }

  handleMessage(message) {
    const entry = this.pending.get(message.id);
    if (!entry) return;

    if (message.type === 'progress') {
      entry.onProgress?.(message);
      return;
    }

    if (message.type === 'bestmove') {
      this.pending.delete(message.id);
      entry.resolve(message);
      return;
    }

    if (message.type === 'error') {
      this.pending.delete(message.id);
      entry.reject(new Error(message.message ?? 'Engine error'));
    }
  }

  request(options, onProgress = null) {
    this.requestId += 1;
    const id = this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ ...options, id });
    });
  }

  search(fen, options = {}, onProgress = null) {
    return this.request(
      {
        type: 'search',
        fen,
        maxDepth: options.maxDepth ?? 4,
        timeLimit: options.timeLimit ?? 2000,
        useBook: options.useBook ?? false,
        randomness: options.randomness ?? 0,
        analysis: false,
        ...options,
      },
      onProgress,
    );
  }

  analyze(fen, options = {}, onProgress = null) {
    return this.request(
      {
        type: 'search',
        fen,
        maxDepth: options.maxDepth ?? 3,
        timeLimit: options.timeLimit ?? 800,
        useBook: false,
        randomness: 0,
        analysis: true,
        ...options,
      },
      onProgress,
    );
  }

  stop() {
    this.failPending(new Error('Engine request cancelled'));
    this.spawn();
  }

  dispose() {
    this.failPending(new Error('Engine disposed'));
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
