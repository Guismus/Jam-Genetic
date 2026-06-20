export class AudioSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  
  // Ambient drone nodes
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private isDroneRunning: boolean = false;

  constructor() {}

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.ctx) {
      if (this.isMuted) {
        this.droneGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      } else {
        this.droneGain?.gain.setTargetAtTime(0.015, this.ctx.currentTime, 0.1);
      }
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  playClick() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    this.resumeCtx();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playMutate() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    this.resumeCtx();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.25);

    // Add vibrato/modulation
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playSpark() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    this.resumeCtx();

    // Synthesis of a small high-frequency crackle/pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(500, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playExplosion() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    this.resumeCtx();

    const now = this.ctx.currentTime;

    // 1. Low frequency thump
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(90, now);
    subOsc.frequency.exponentialRampToValueAtTime(20, now + 0.45);
    subGain.gain.setValueAtTime(0.25, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.45);

    // 2. White noise hiss burst
    try {
      const bufferSize = this.ctx.sampleRate * 0.4; // 0.4 seconds
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + 0.4);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.15, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.005, now + 0.4);

      noiseNode.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noiseNode.start(now);
      noiseNode.stop(now + 0.4);
    } catch (e) {
      // Fallback if buffer generation fails
      const fallbackOsc = this.ctx.createOscillator();
      const fallbackGain = this.ctx.createGain();
      fallbackOsc.type = 'triangle';
      fallbackOsc.frequency.setValueAtTime(200, now);
      fallbackOsc.frequency.setValueAtTime(40, now + 0.3);
      fallbackGain.gain.setValueAtTime(0.1, now);
      fallbackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      fallbackOsc.connect(fallbackGain);
      fallbackGain.connect(this.ctx.destination);
      fallbackOsc.start(now);
      fallbackOsc.stop(now + 0.3);
    }
  }

  playWin() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    this.resumeCtx();

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 major arpeggio

    notes.forEach((freq, index) => {
      const time = now + index * 0.12;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.08, time);
      gain.gain.exponentialRampToValueAtTime(0.005, time + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(time);
      osc.stop(time + 0.4);
    });
  }

  playLose() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    this.resumeCtx();

    const now = this.ctx.currentTime;
    const notes = [220.00, 261.63, 196.00]; // A3, C4, G3 (mournful minor decay)

    notes.forEach((freq, index) => {
      const time = now + index * 0.15;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.linearRampToValueAtTime(freq - 15, time + 0.6);

      // Lowpass filter to make it softer
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, time);

      gain.gain.setValueAtTime(0.06, time);
      gain.gain.exponentialRampToValueAtTime(0.005, time + 0.6);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(time);
      osc.stop(time + 0.6);
    });
  }

  startAmbientDrone() {
    this.init();
    if (!this.ctx || this.isDroneRunning) return;
    this.resumeCtx();

    const now = this.ctx.currentTime;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(this.isMuted ? 0 : 0.015, now);

    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sine';
    this.droneOsc1.frequency.setValueAtTime(55.0, now); // A1

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'sine';
    this.droneOsc2.frequency.setValueAtTime(55.4, now); // slightly detuned for beating

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, now);

    this.droneOsc1.connect(filter);
    this.droneOsc2.connect(filter);
    filter.connect(this.droneGain);
    this.droneGain.connect(this.ctx.destination);

    this.droneOsc1.start();
    this.droneOsc2.start();
    this.isDroneRunning = true;
  }

  stopAmbientDrone() {
    if (!this.ctx || !this.isDroneRunning) return;

    this.droneOsc1?.stop();
    this.droneOsc2?.stop();
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.isDroneRunning = false;
  }

  private resumeCtx() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
}
export const audio = new AudioSynth();
