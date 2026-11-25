// Layered procedural impacts and a continuous drill, with an optional cached local CC0 recording.
// Source/license: reference/weapons19/audio-drill-source.json. No scheduling timers.
// Optional samples are predecoded AudioBuffers, loaded once by the caller from licensed local files.
const CUES = {
  fist: [['triangle', 260, 75, .11, .16]],
  hammer: [['sine', 420, 95, .19, .17], ['triangle', 800, 230, .10, .06]],
  // Independent alloy impact: broadband attack then prominent inharmonic metal modes.
  // Measured reference characteristics (not sampled audio): reference/impact23/bat-reference.json.
  bat: [['sine', 1830, 1790, .34, .10, .007, .001], ['sine', 2610, 2580, .17, .035, .004, .001], ['triangle', 185, 90, .09, .11, 0, .001]],
  'bat-swing': [],
  wave: [['sawtooth', 850, 160, .22, .07], ['sine', 140, 55, .17, .12]],
  drill: [['square', 145, 90, .08, .07], ['triangle', 310, 190, .10, .08]],
  ball: [['sine', 220, 48, .25, .19], ['triangle', 470, 180, .13, .06]],
  bomb: [['triangle', 125, 35, .29, .16], ['sine', 650, 65, .14, .09]],
  shotgun: [],
  'shotgun-pump': [],
  'mini-fuse': [],
  'mini-blast': [],
  excavator: [['sawtooth', 92, 50, .20, .06], ['triangle', 320, 70, .17, .14, .03]],
  meteor: [['triangle', 540, 60, .27, .12], ['sine', 110, 32, .32, .15, .04]],
  nuke: [['triangle', 215, 105, 1.35, .17, .015, .008], ['sine', 125, 82, 2.65, .14, .035, .03], ['sine', 52, 30, 5.6, .095, .06, .09]],
  // Kept as a harmless legacy key: countdown and silent descent replace the whistle.
  'nuke-fall': [],
  'nuke-air': [],
  countdown: [['triangle', 180, 145, .045, .12, 0, .001]],
  bomber: [['sawtooth', 118, 64, .72, .045, 0, .14], ['triangle', 178, 94, .76, .035, .06, .12]],
  coin: [['sine', 740, 1000, .11, .11], ['sine', 1120, 1400, .12, .09, .07]],
};

const NOISE_CUES = {
  shotgun: [
    { from: 5000, to: 1800, duration: .045, volume: .10, filter: 'highpass', attack: .001 },
    { from: 520, to: 220, duration: .18, volume: .13, filter: 'lowpass', delay: .006, attack: .002, body: true },
  ],
  'shotgun-pump': [
    { from: 1800, to: 950, duration: .075, volume: .14, filter: 'bandpass', attack: .001 },
    { from: 950, to: 2100, duration: .08, volume: .18, filter: 'bandpass', delay: .115, attack: .001 },
  ],
  'mini-fuse': [{ from: 3200, to: 2200, duration: 1.5, volume: .07, filter: 'bandpass', attack: .04, body: true }],
  'mini-blast': [
    { from: 3400, to: 800, duration: .09, volume: .15, filter: 'highpass', attack: .001 },
    { from: 650, to: 180, duration: 1.15, volume: .22, filter: 'lowpass', delay: .018, attack: .012, body: true },
  ],
  'nuke-air': [{ from: 650, to: 1600, duration: 3, volume: .24, filter: 'lowpass', attack: 2.7 }],
  'bat-swing': [{ from: 1800, to: 380, duration: .17, volume: .075, attack: .07 }],
  bat: [
    { from: 4700, to: 1400, duration: .04, volume: .18, filter: 'highpass', attack: .001 },
    { from: 1600, to: 340, duration: .16, volume: .13, filter: 'bandpass', delay: .008, attack: .003 },
  ],
  nuke: [
    { from: 7000, to: 850, duration: .09, volume: .19, filter: 'highpass', attack: .001 },
    { from: 800, to: 180, duration: 1.85, volume: .15, filter: 'bandpass', delay: .035, attack: .015, body: true },
    { from: 1050, to: 180, duration: 5.6, volume: .14, filter: 'lowpass', delay: .16, attack: .12, body: true },
    { from: 1500, to: 230, duration: 3.4, volume: .095, filter: 'lowpass', delay: .8, attack: .18, body: true },
    { from: 950, to: 140, duration: 3.6, volume: .08, filter: 'lowpass', delay: 2.1, attack: .3, body: true },
  ],
  bomber: [{ from: 980, to: 310, duration: .77, volume: .06, filter: 'lowpass', attack: .17 }],
};

const MAX_VOICES = 12;
const SILENCE = .0001;
const MASTER_GAIN = .19;
// Shared master stays fixed; individual weapon trims do not affect the other tools.
// Human countdown source/license: reference/countdown21/audio-source.json (ckvoiceover, CC BY 4.0).
const CUE_TRIM = { bat: 3.3, 'bat-swing': 2, nuke: 2.8, 'mini-blast': 1 };

export function createComicAudio({ AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext, samples = {}, fetch: fetchAudio = globalThis.fetch } = {}) {
  let context = null, master = null, enabled = false, disposed = false;
  let noiseBuffer = null, noiseUnavailable = false, drillTexture = null;
  let drillRecording = null, drillLoad = null, drillLoadAbort = null;
  const countdownRecordings = new Map();
  let countdownLoad = null, countdownLoadAbort = null, countdownNumber = null;
  let blastRecording = null, blastLoad = null, blastLoadAbort = null;
  let miniBlastRecording = null, miniBlastLoad = null, miniBlastLoadAbort = null;
  let shotgunRecording = null, shotgunLoad = null, shotgunLoadAbort = null;
  let lastImpact = -Infinity, lastRubble = -Infinity, lastRumble = -Infinity;
  const voices = new Set(), recordings = new Map();
  let drill = null;
  for (const [id, buffer] of Object.entries(samples)) setSample(id, buffer);
  function disconnect(nodes) { for (const node of nodes) { try { node.disconnect(); } catch {} } }
  function release(voice) {
    if (!voices.delete(voice)) return;
    voice.source.onended = null;
    disconnect(voice.nodes);
  }
  function stop(voice) {
    try { voice.source.stop(); } catch {}
    release(voice);
  }
  function makeRoom() {
    while (voices.size >= MAX_VOICES) {
      // Sustained motor sources survive fracture bursts; old one-shots can be stolen.
      stop([...voices].find(voice => !voice.motor) || voices.values().next().value);
    }
  }
  function setSample(id, buffer) {
    if (disposed || !Object.hasOwn(CUES, id)) return false;
    if (buffer == null) { recordings.delete(id); return true; }
    if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.duration > 8 || typeof buffer.getChannelData !== 'function') return false;
    recordings.set(id, buffer);
    return true;
  }
  function loadDrillLoop(url = new URL('../assets/audio/drill-loop.wav', import.meta.url).href) {
    if (disposed || typeof fetchAudio !== 'function' || !ensureContext() || typeof context.decodeAudioData !== 'function') return Promise.resolve(false);
    if (drillLoad) return drillLoad;
    const decodingContext = context;
    drillLoadAbort = typeof AbortController === 'function' ? new AbortController() : null;
    // Loading never blocks input or starts a voice. A running press keeps its existing circuit.
    drillLoad = (async () => {
      try {
        const response = await fetchAudio(url, { signal: drillLoadAbort?.signal });
        if (!response.ok) return false;
        const bytes = await response.arrayBuffer();
        if (disposed || bytes.byteLength > 1024 * 1024) return false;
        const buffer = await decodingContext.decodeAudioData(bytes);
        if (disposed || context !== decodingContext || !Number.isFinite(buffer?.duration) || buffer.duration <= 0 || buffer.duration > 8 || typeof buffer.getChannelData !== 'function') return false;
        drillRecording = buffer;
        return true;
      } catch { return false; }
    })();
    return drillLoad;
  }
  function loadImpactSample(url = new URL('../assets/audio/blast-transient.wav', import.meta.url).href) {
    if (disposed || typeof fetchAudio !== 'function' || !ensureContext() || typeof context.decodeAudioData !== 'function') return Promise.resolve(false);
    if (blastLoad) return blastLoad;
    const decodingContext = context;
    blastLoadAbort = typeof AbortController === 'function' ? new AbortController() : null;
    blastLoad = (async () => {
      try {
        const response = await fetchAudio(url, { signal: blastLoadAbort?.signal });
        if (!response.ok) return false;
        const bytes = await response.arrayBuffer();
        if (disposed || bytes.byteLength > 1024 * 1024) return false;
        const buffer = await decodingContext.decodeAudioData(bytes);
        if (disposed || context !== decodingContext || !Number.isFinite(buffer?.duration) || buffer.duration <= 0 || buffer.duration > 2 || typeof buffer.getChannelData !== 'function') return false;
        blastRecording = buffer;
        return true;
      } catch { return false; }
    })();
    return blastLoad;
  }
  // CC0 field-recorded demolition excerpt, independent of the existing nuclear sample.
  function loadMiniBlastSample(url = new URL('../assets/audio/mini-blast.wav', import.meta.url).href) {
    if (disposed || typeof fetchAudio !== 'function' || !ensureContext() || typeof context.decodeAudioData !== 'function') return Promise.resolve(false);
    if (miniBlastLoad) return miniBlastLoad;
    const decodingContext = context;
    miniBlastLoadAbort = typeof AbortController === 'function' ? new AbortController() : null;
    miniBlastLoad = (async () => {
      try {
        const response = await fetchAudio(url, { signal: miniBlastLoadAbort?.signal });
        if (!response.ok) return false;
        const bytes = await response.arrayBuffer();
        if (disposed || bytes.byteLength > 150000) return false;
        const buffer = await decodingContext.decodeAudioData(bytes);
        if (disposed || context !== decodingContext || !Number.isFinite(buffer?.duration) || buffer.duration <= 0 || buffer.duration > 2 || typeof buffer.getChannelData !== 'function') return false;
        miniBlastRecording = buffer;
        return true;
      } catch { return false; }
    })();
    return miniBlastLoad;
  }
  // CC0 clay-shooting field recording; pump mechanics remain separately synthesized.
  function loadShotgunSample(url = new URL('../assets/audio/shotgun-shot.wav', import.meta.url).href) {
    if (disposed || typeof fetchAudio !== 'function' || !ensureContext() || typeof context.decodeAudioData !== 'function') return Promise.resolve(false);
    if (shotgunLoad) return shotgunLoad;
    const decodingContext = context;
    shotgunLoadAbort = typeof AbortController === 'function' ? new AbortController() : null;
    shotgunLoad = (async () => {
      try {
        const response = await fetchAudio(url, { signal: shotgunLoadAbort?.signal });
        if (!response.ok) return false;
        const bytes = await response.arrayBuffer();
        if (disposed || bytes.byteLength > 120000) return false;
        const buffer = await decodingContext.decodeAudioData(bytes);
        if (disposed || context !== decodingContext || !Number.isFinite(buffer?.duration) || buffer.duration <= 0 || buffer.duration > 1.5 || typeof buffer.getChannelData !== 'function') return false;
        shotgunRecording = buffer;
        return true;
      } catch { return false; }
    })();
    return shotgunLoad;
  }
  function loadCountdownSamples() {
    if (disposed || typeof fetchAudio !== 'function' || !ensureContext() || typeof context.decodeAudioData !== 'function') return Promise.resolve(false);
    if (countdownLoad) return countdownLoad;
    const decodingContext = context;
    countdownLoadAbort = typeof AbortController === 'function' ? new AbortController() : null;
    // Publish the three voices atomically: a partial download keeps the consistent tick fallback.
    countdownLoad = (async () => {
      try {
        const loaded = await Promise.all([3, 2, 1].map(async number => {
          const url = new URL(`../assets/audio/countdown-${number}.wav`, import.meta.url).href;
          const response = await fetchAudio(url, { signal: countdownLoadAbort?.signal });
          if (!response.ok) throw Error('Countdown unavailable');
          const bytes = await response.arrayBuffer();
          if (disposed || bytes.byteLength > 256 * 1024) throw Error('Countdown discarded');
          const buffer = await decodingContext.decodeAudioData(bytes);
          if (disposed || context !== decodingContext || !Number.isFinite(buffer?.duration) || buffer.duration <= 0 || buffer.duration >= .8 || typeof buffer.getChannelData !== 'function') throw Error('Invalid countdown clip');
          return [number, buffer];
        }));
        if (disposed) return false;
        for (const [number, buffer] of loaded) countdownRecordings.set(number, buffer);
        return true;
      } catch { countdownLoadAbort?.abort(); return false; }
    })();
    return countdownLoad;
  }
  function playCountdown(number) {
    if (!Number.isInteger(number) || number < 1 || number > 3 || !enabled || disposed || countdownNumber === number || !ensureContext()) return false;
    // Every caller-controlled boundary emits at most one current word. No delayed replay on load.
    stopCue('countdown'); countdownNumber = number;
    const recording = countdownRecordings.get(number);
    if (recording) {
      resume();
      if (schedule({ recording, duration: recording.duration, volume: 1, cue: 'countdown', from: 100, to: 50, attack: .003 })) return true;
    }
    return play('countdown');
  }
  function ramp(param, value, seconds = .06) {
    const now = context.currentTime;
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else {
      param.cancelScheduledValues?.(now);
      param.setValueAtTime(Number.isFinite(param.value) ? param.value : value, now);
    }
    param.linearRampToValueAtTime(value, now + seconds);
  }
  function stopAll() {
    drill = null; countdownNumber = null;
    for (const voice of [...voices]) stop(voice);
    lastImpact = lastRubble = lastRumble = -Infinity;
  }
  function startDrill() {
    if (!enabled || disposed || !ensureContext()) return false;
    if (drill) return true;
    resume();
    const motor = { voices: [], contact: -1, recorded: Boolean(drillRecording) };
    try {
      for (let layer = 0; layer < 3; layer++) {
        makeRoom();
        const nodes = [];
        let source;
        try {
          const buffer = layer === 0 && drillRecording ? drillRecording : layer === 2 ? getDrillTexture() : null;
          if (buffer) {
            try { source = context.createBufferSource(); source.buffer = buffer; source.loop = true; }
            catch { if (source) disconnect([source]); source = null; if (layer === 0) motor.recorded = false; }
          }
          if (!source) {
            source = context.createOscillator(); source.type = layer === 0 || motor.recorded && layer === 1 ? 'sawtooth' : 'triangle';
            source.frequency.setValueAtTime(layer === 0 || motor.recorded && layer === 1 ? 135 : layer === 1 ? 730 : 920, context.currentTime);
          }
          nodes.push(source);
          const gain = context.createGain(); nodes.push(gain);
          gain.gain.setValueAtTime(SILENCE, context.currentTime);
          gain.gain.linearRampToValueAtTime(layer === 0 ? motor.recorded ? .42 : .065 : layer === 1 ? .035 : .012, context.currentTime + .07);
          let tail = source, filter = null;
          if (layer === 2) {
            try {
              filter = context.createBiquadFilter(); filter.type = 'bandpass';
              filter.frequency.setValueAtTime(1400, context.currentTime); filter.Q.setValueAtTime(.6, context.currentTime);
              source.connect(filter); nodes.push(filter); tail = filter;
            } catch { if (filter) disconnect([filter]); filter = null; }
          }
          tail.connect(gain); gain.connect(master);
          const voice = { source, nodes, gain, filter, layer, cue: 'drill-motor', motor: true };
          voices.add(voice); motor.voices.push(voice);
          source.onended = () => release(voice);
          source.start(context.currentTime);
        } catch {
          try { source?.stop(); } catch {}
          disconnect(nodes);
          throw Error('Motor unavailable');
        }
      }
      drill = motor;
      // Preserve the initial spin-up ramp; contact changes modulate these same sources.
      motor.contact = 0;
      return true;
    } catch {
      for (const voice of motor.voices) stop(voice);
      return false;
    }
  }
  function setDrillContact(value) {
    if (!drill || !enabled || disposed) return false;
    const number = Number(value);
    if (!Number.isFinite(number)) return false;
    const contact = Math.round(Math.max(0, Math.min(1, number)) * 20) / 20;
    if (drill.contact === contact) return true;
    drill.contact = contact;
    for (const voice of drill.voices) {
      const { source, gain, filter, layer } = voice;
      // The motor slows under load while the grit gets louder and brighter.
      if (source.frequency) ramp(source.frequency, (layer === 0 || drill.recorded && layer === 1 ? 135 : layer === 1 ? 730 : 920) * (1 - contact * .15));
      if (layer === 0 && drill.recorded && source.playbackRate) ramp(source.playbackRate, 1 - contact * .12);
      ramp(gain.gain, layer === 0 ? drill.recorded ? .42 + .3 * contact : .065 + .025 * contact : layer === 1 ? .035 + .02 * contact : .012 + .12 * contact);
      if (filter) ramp(filter.frequency, 1400 + contact * 1900);
    }
    return true;
  }
  function stopDrill() {
    if (!drill) return false;
    const motor = drill; drill = null;
    for (const voice of motor.voices) {
      voice.motor = false;
      try {
        ramp(voice.gain.gain, SILENCE, .05);
        if (voice.source.frequency) ramp(voice.source.frequency, 45, .05);
        voice.source.stop(context.currentTime + .055);
      } catch { stop(voice); }
    }
    return true;
  }
  function ensureContext() {
    if (disposed || !AudioContext) return false;
    if (context) return true;
    try {
      context = new AudioContext(); master = context.createGain();
      master.gain.setValueAtTime(MASTER_GAIN, context.currentTime);
      master.connect(context.destination); return true;
    } catch {
      try { master?.disconnect(); context?.close()?.catch?.(() => {}); } catch {}
      context = null; master = null; return false;
    }
  }
  function resume() { try { context.resume()?.catch?.(() => {}); } catch {} }
  function setEnabled(value) {
    if (disposed) return false;
    enabled = Boolean(value);
    if (enabled && ensureContext()) {
      try { master.gain.setValueAtTime(MASTER_GAIN, context.currentTime); } catch {}
      resume();
    } else if (!enabled) {
      stopAll();
      try { master?.gain.setValueAtTime(0, context.currentTime); } catch {}
    }
    return enabled;
  }

  // One finite buffer is shared by rubble and the filtered motor loop.
  function getNoise() {
    if (noiseBuffer || noiseUnavailable) return noiseBuffer;
    try {
      const rate = context.sampleRate;
      if (!Number.isFinite(rate) || rate <= 0) throw Error('No audio sample rate');
      const buffer = context.createBuffer(1, Math.ceil(rate * .9), rate);
      const samples = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < samples.length; i++) {
        const white = Math.random() * 2 - 1;
        previous = (previous + .035 * white) / 1.035;
        samples[i] = Math.max(-1, Math.min(1, white * .65 + previous * 2));
      }
      noiseBuffer = buffer;
    } catch { noiseUnavailable = true; }
    return noiseBuffer;
  }

  function getDrillTexture() {
    if (drillTexture) return drillTexture;
    const noise = getNoise();
    if (!noise) return null;
    try {
      const rate = context.sampleRate, length = Math.ceil(rate);
      const buffer = context.createBuffer(1, length, rate), samples = buffer.getChannelData(0);
      // Percussive rotary chatter is already in the buffer, so it costs one source, no LFO/timer.
      for (let i = 0; i < length; i++) {
        const t = i / rate;
        const pulse = Math.pow(.5 + .5 * Math.sin(2 * Math.PI * 74 * t), 5);
        samples[i] = (Math.random() * 2 - 1) * (.15 + .75 * pulse);
      }
      drillTexture = buffer;
      return buffer;
    } catch { return noise; }
  }

  function schedule({ type = 'triangle', from, to, duration, volume, delay = 0, noise = false, filter = 'bandpass', attack = .006, cue = null, recording = null, body = false }) {
    const nodes = [];
    let source = null, voice = null;
    try {
      makeRoom();
      const buffer = recording || (noise ? getNoise() : null);
      if (buffer) {
        try { source = context.createBufferSource(); source.buffer = buffer; }
        catch {
          if (source) disconnect([source]); source = null;
          if (recording) return false;
          noiseUnavailable = true; noiseBuffer = null;
        }
      }
      // Air and a lit fuse stay broadband; unavailable noise is silent, never a pitched fallback.
      if (!source && (cue === 'nuke-air' || cue === 'mini-fuse' || cue === 'mini-blast' || cue === 'shotgun' || cue === 'shotgun-pump')) return false;
      if (!source) {
        source = context.createOscillator(); source.type = type;
        const scale = noise ? .18 : 1;
        source.frequency.setValueAtTime(Math.max(35, from * scale), context.currentTime + delay);
        source.frequency.exponentialRampToValueAtTime(Math.max(28, to * scale), context.currentTime + delay + duration);
      }
      nodes.push(source);
      const gain = context.createGain(); nodes.push(gain);
      const start = context.currentTime + delay;
      let tail = source;
      if (buffer && source.buffer && !recording) {
        let toneFilter = null;
        try {
          toneFilter = context.createBiquadFilter();
          toneFilter.type = filter;
          toneFilter.frequency.setValueAtTime(from, start);
          toneFilter.frequency.exponentialRampToValueAtTime(to, start + duration);
          toneFilter.Q.setValueAtTime(.7, start);
          source.connect(toneFilter); tail = toneFilter; nodes.push(toneFilter);
        } catch { if (toneFilter) disconnect([toneFilter]); }
      }
      gain.gain.setValueAtTime(SILENCE, start);
      gain.gain.linearRampToValueAtTime(volume, start + Math.min(attack, duration * .9));
      if (recording) gain.gain.setValueAtTime(volume, start + Math.max(duration / 2, duration - .015));
      else if (body) gain.gain.exponentialRampToValueAtTime(volume * .32, start + duration * .72);
      gain.gain.exponentialRampToValueAtTime(SILENCE, start + duration);
      tail.connect(gain); gain.connect(master);
      voice = { source, nodes, cue }; voices.add(voice);
      source.onended = () => release(voice);
      // Long noise tails repeat the same short buffer, with their finite envelope/stop intact.
      if (noise && source.buffer && duration > .9) source.loop = true;
      source.start(start); source.stop(start + duration + .015);
      return true;
    } catch {
      if (voice) stop(voice);
      else { try { source?.stop(); } catch {} disconnect(nodes); if (source && !nodes.includes(source)) disconnect([source]); }
      return false;
    }
  }

  function play(id) {
    if (id === 'nuke-fall') return false; // Do not revive the removed whistle via sample overrides.
    if (!enabled || disposed || !Object.hasOwn(CUES, id) || !ensureContext()) return false;
    resume();
    const recording = recordings.get(id);
    if (recording && schedule({ recording, duration: recording.duration, volume: .65, cue: id, from: 100, to: 50, attack: .003 })) return true;
    let played = id === 'nuke' && blastRecording ? schedule({ recording: blastRecording, duration: blastRecording.duration, volume: .9, cue: 'nuke', from: 100, to: 50, attack: .001 }) : false;
    if (id === 'mini-blast' && miniBlastRecording) played = schedule({ recording: miniBlastRecording, duration: miniBlastRecording.duration, volume: .9, cue: id, from: 100, to: 50, attack: .0005 }) || played;
    if (id === 'shotgun' && shotgunRecording) played = schedule({ recording: shotgunRecording, duration: shotgunRecording.duration, volume: 1, cue: id, from: 100, to: 50, attack: .0005 }) || played;
    const trim = CUE_TRIM[id] || 1;
    for (const [type, from, to, duration, volume, delay = 0, attack = .006] of CUES[id]) {
      played = schedule({ type, from, to, duration, volume: volume * trim, delay, attack, cue: id, body: (id === 'nuke' && duration > 1) || (id === 'bat' && type === 'sine') }) || played;
    }
    for (const layer of NOISE_CUES[id] || []) played = schedule({ ...layer, volume: layer.volume * trim, noise: true, cue: id }) || played;
    return played;
  }

  // An action cancellation can silence its approach cue without muting other hits.
  function stopCue(id) {
    if (id === 'countdown') countdownNumber = null;
    if (id === 'drill' || id === 'drill-motor') stopDrill();
    for (const voice of [...voices]) if (voice.cue === id) stop(voice);
  }

  function playDestruction({ weight = 0, count = 0, clearedCount = 0 } = {}) {
    if (!enabled || disposed || !Number.isFinite(weight) || !Number.isFinite(count) || weight <= 0 || count < 1 || !ensureContext()) return false;
    const now = context.currentTime;
    // Drill impacts arrive every 90 ms. Preserve each crack, but group the falling tail.
    if (now - lastImpact < .075) return false;
    lastImpact = now;
    resume();
    const mass = Math.min(1, Math.log1p(weight) / Math.log(2501));
    const pieces = Math.min(1, Math.log1p(count) / Math.log(241));
    const size = mass * .6 + pieces * .4;
    let played = schedule({ noise: true, from: 4700 - size * 2400, to: 1400 - size * 850, duration: .055 + size * .065, volume: .12 + size * .07 });
    if (now - lastRubble >= .16) {
      lastRubble = now;
      played = schedule({ noise: true, filter: 'lowpass', from: 1800 - size * 900, to: 430 - size * 220, duration: .14 + size * .25, volume: .10 + size * .07, delay: .025 }) || played;
      const clacks = 2 + Math.floor(pieces * 2);
      for (let i = 0; i < clacks; i++) {
        played = schedule({ noise: true, from: (2800 - size * 1300) / (1 + i * .12), to: 550 - size * 260,
          duration: .035 + size * .035, volume: (.065 + size * .035) / (1 + i * .35), delay: .09 + i * (.07 + size * .035) }) || played;
      }
    }
    if (Number.isFinite(clearedCount) && clearedCount > 0 && now - lastRumble >= .65) {
      lastRumble = now;
      played = schedule({ type: 'sine', from: 95 - size * 20, to: 30, duration: .44 + size * .22, volume: .13, delay: .035 }) || played;
    }
    return played;
  }

  return {
    // Shared output for the heavy-weapon / shield synth (src/heavy-weapons-audio.js): null while sound is off.
    output() { if (!enabled || disposed || !ensureContext()) return null; resume(); return { context, destination: master }; },
    setEnabled, play, playDestruction, stopCue, startDrill, setDrillContact, stopDrill, stopAll, setSample, loadDrillLoop, loadImpactSample, loadMiniBlastSample, loadShotgunSample, loadCountdownSamples, playCountdown, get enabled() { return enabled; },
    get stats() { return { enabled, activeVoices: voices.size, maxVoices: MAX_VOICES, drilling: Boolean(drill), contact: drill?.contact ?? 0, samples: recordings.size, drillSampleReady: Boolean(drillRecording), blastSampleReady: Boolean(blastRecording), miniBlastSampleReady: Boolean(miniBlastRecording), shotgunSampleReady: Boolean(shotgunRecording), countdownSamplesReady: countdownRecordings.size === 3, countdownNumber, masterGain: MASTER_GAIN, drillSource: drill ? drill.recorded ? 'recording' : 'synthesis' : null }; },
    dispose() {
      if (disposed) return;
      setEnabled(false); disposed = true; drillLoadAbort?.abort(); blastLoadAbort?.abort(); miniBlastLoadAbort?.abort(); shotgunLoadAbort?.abort(); countdownLoadAbort?.abort();
      try { master?.disconnect(); context?.close()?.catch?.(() => {}); } catch {}
      context = null; master = null; noiseBuffer = null; drillTexture = null; drillRecording = null; blastRecording = null; miniBlastRecording = null; shotgunRecording = null; recordings.clear(); countdownRecordings.clear();
    },
  };
}

