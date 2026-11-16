// Tiny synthesized SFX — no audio files, a warm metallic forge palette.

export const sfx = (() => {
  let ctx = null;
  let master = null;
  let muted = false;
  let noiseBuffer = null;
  let lastHit = 0;

  function ensure() {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);
      } catch {
        return null;
      }
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function getNoise() {
    if (!ctx) return null;
    if (!noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 0.5);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      }
    }
    return noiseBuffer;
  }

  function tone(freq, opts = {}) {
    if (!ctx || muted) return;
    const {
      end = freq, dur = 0.14, type = "sine", vol = 0.06, delay = 0,
    } = opts;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (end !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(opts = {}) {
    if (!ctx || muted) return;
    const { dur = 0.1, vol = 0.1, freq = 2200, q = 1, type = "bandpass", delay = 0 } = opts;
    const buffer = getNoise();
    if (!buffer) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 1 + Math.random() * 0.15;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  return {
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = !!value;
      // Never create/resume the AudioContext here: muting changes can happen
      // before the first user gesture, and browsers would warn or block it.
      if (master) master.gain.value = muted ? 0 : 0.55;
    },
    isMuted() { return muted; },

    hit(crit = false) {
      if (muted) return;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastHit < 36) return;
      lastHit = now;
      if (!ensure()) return;
      if (crit) {
        tone(1320, { end: 720, dur: 0.18, type: "triangle", vol: 0.07 });
        tone(1980, { dur: 0.1, type: "sine", vol: 0.03, delay: 0.01 });
        noise({ dur: 0.16, vol: 0.12, freq: 3200, q: 0.9 });
      } else {
        tone(760 + Math.random() * 60, { end: 420, dur: 0.09, type: "triangle", vol: 0.05 });
        noise({ dur: 0.075, vol: 0.09, freq: 2100 + Math.random() * 500, q: 1.2 });
      }
    },

    buy() {
      if (!ensure()) return;
      tone(180, { end: 92, dur: 0.17, type: "sine", vol: 0.075 });
      noise({ dur: 0.07, vol: 0.06, freq: 700, q: 0.8, type: "lowpass" });
      tone(520, { dur: 0.07, type: "triangle", vol: 0.025, delay: 0.02 });
    },

    error() {
      if (!ensure()) return;
      tone(150, { end: 110, dur: 0.12, type: "square", vol: 0.025 });
    },

    surge() {
      if (!ensure()) return;
      tone(70, { end: 440, dur: 0.7, type: "sawtooth", vol: 0.05 });
      tone(140, { end: 880, dur: 0.65, type: "triangle", vol: 0.04, delay: 0.05 });
      noise({ dur: 0.8, vol: 0.1, freq: 900, q: 0.6, type: "bandpass" });
    },

    surgeEnd() {
      if (!ctx || muted) return;
      tone(300, { end: 90, dur: 0.4, type: "sine", vol: 0.04 });
    },

    vein() {
      if (!ensure()) return;
      const notes = [880, 1174.7, 1568, 2093];
      notes.forEach((f, i) => tone(f, { dur: 0.22, type: "sine", vol: 0.045, delay: i * 0.055 }));
      noise({ dur: 0.3, vol: 0.05, freq: 5200, q: 0.8 });
    },

    // Trophies can unlock from the idle loop and "ready" can fire on a vein
    // spawn — never create an AudioContext from those. Only play if audio has
    // already been unlocked by a real user gesture.
    ach() {
      if (!ctx || muted) return;
      tone(1046.5, { dur: 0.18, type: "sine", vol: 0.05 });
      tone(1568, { dur: 0.26, type: "sine", vol: 0.04, delay: 0.09 });
    },

    ready() {
      if (!ctx || muted) return;
      tone(523, { dur: 0.1, type: "triangle", vol: 0.04 });
      tone(784, { dur: 0.18, type: "triangle", vol: 0.04, delay: 0.08 });
    },

    prestige() {
      if (!ensure()) return;
      const chord = [174.6, 261.6, 349.2, 523.3, 698.5];
      chord.forEach((f, i) => {
        tone(f, { dur: 1.1, type: "sine", vol: 0.055, delay: i * 0.07 });
        tone(f * 2, { dur: 0.8, type: "triangle", vol: 0.015, delay: 0.05 + i * 0.07 });
      });
      noise({ dur: 1.2, vol: 0.06, freq: 1400, q: 0.4, type: "lowpass" });
    },
  };
})();
