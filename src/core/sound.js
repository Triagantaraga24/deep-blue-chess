export class SoundEngine {
  constructor() {
    this.enabled = true;
    this.context = null;
  }

  unlock() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
    }
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  setEnabled(value) {
    this.enabled = value;
  }

  tone(frequency, duration, options = {}) {
    if (!this.enabled || !this.context) return;
    const { type = 'sine', gain = 0.06, delay = 0, slide = 0 } = options;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + slide), now + duration);
    }
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gain, now + 0.012);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  noise(duration = 0.08, gain = 0.045) {
    if (!this.enabled || !this.context) return;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      const envelope = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * envelope * envelope;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gainNode = this.context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    gainNode.gain.value = gain;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.context.destination);
    source.start();
  }

  play(kind) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.context) return;
    switch (kind) {
      case 'select':
        this.tone(660, 0.05, { type: 'sine', gain: 0.025 });
        break;
      case 'move':
        this.noise(0.07, 0.035);
        this.tone(190, 0.09, { type: 'triangle', gain: 0.035, slide: -40 });
        break;
      case 'capture':
        this.noise(0.13, 0.07);
        this.tone(120, 0.16, { type: 'triangle', gain: 0.06, slide: -40 });
        break;
      case 'castle':
        this.noise(0.09, 0.04);
        this.tone(240, 0.1, { type: 'triangle', gain: 0.035 });
        break;
      case 'check':
        this.tone(880, 0.11, { type: 'sine', gain: 0.04 });
        this.tone(1174, 0.14, { type: 'sine', gain: 0.03, delay: 0.08 });
        break;
      case 'gameover':
        this.tone(392, 0.3, { type: 'sine', gain: 0.05 });
        this.tone(494, 0.32, { type: 'sine', gain: 0.04, delay: 0.12 });
        this.tone(587, 0.5, { type: 'sine', gain: 0.045, delay: 0.24 });
        break;
      case 'win':
        this.tone(523, 0.22, { type: 'sine', gain: 0.05 });
        this.tone(659, 0.22, { type: 'sine', gain: 0.045, delay: 0.11 });
        this.tone(784, 0.45, { type: 'sine', gain: 0.05, delay: 0.22 });
        break;
      case 'illegal':
        this.tone(150, 0.12, { type: 'sawtooth', gain: 0.022, slide: -20 });
        break;
      default:
        break;
    }
  }
}
