const SETTINGS_KEY = 'dbgc.settings.v1';

export function loadSettings(defaults) {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable in private mode.
  }
}

export class GameStore {
  constructor() {
    this.dbName = 'deep-blue-chess';
    this.version = 1;
    this.db = null;
    this.ready = this.open();
  }

  open() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    return new Promise((resolve) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('games')) {
          const games = db.createObjectStore('games', { keyPath: 'id', autoIncrement: true });
          games.createIndex('date', 'date');
        }
        if (!db.objectStoreNames.contains('positions')) {
          const positions = db.createObjectStore('positions', { keyPath: 'id', autoIncrement: true });
          positions.createIndex('date', 'date');
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = () => resolve(null);
    });
  }

  async add(storeName, value) {
    await this.ready;
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).add(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }

  async all(storeName) {
    await this.ready;
    if (!this.db) return [];
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => resolve([]);
    });
  }

  async remove(storeName, id) {
    await this.ready;
    if (!this.db) return false;
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  async clear(storeName) {
    await this.ready;
    if (!this.db) return false;
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  addGame(record) {
    return this.add('games', { ...record, date: record.date ?? Date.now() });
  }

  getGames() {
    return this.all('games');
  }

  deleteGame(id) {
    return this.remove('games', id);
  }

  addPosition(record) {
    return this.add('positions', { ...record, date: record.date ?? Date.now() });
  }

  getPositions() {
    return this.all('positions');
  }

  deletePosition(id) {
    return this.remove('positions', id);
  }
}
