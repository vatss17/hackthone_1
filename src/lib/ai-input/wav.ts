/**
 * Turns a recording into a small, standard WAV clip (16 kHz, mono, 16-bit) in the browser, so every browser's recorder output
 * (WebM/Opus on Chrome and Firefox, MP4/AAC on Safari) reaches the server in one format the speech model reads reliably.
 */
export const TARGET_RATE = 16000;

/** Averages channels into one. */
export function downmix(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const c of channels) for (let i = 0; i < out.length; i++) out[i] += c[i] / channels.length;
  return out;
}

/** Linear resampling: plenty for speech. */
export function resample(input: Float32Array, from: number, to: number = TARGET_RATE): Float32Array {
  if (from === to) return input;
  const n = Math.max(1, Math.round((input.length * to) / from));
  const out = new Float32Array(n);
  const ratio = (input.length - 1) / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const i1 = Math.min(input.length - 1, i0 + 1);
    out[i] = input[i0] + (input[i1] - input[i0]) * (x - i0);
  }
  return out;
}

export function encodeWav(samples: Float32Array, rate: number = TARGET_RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(bytes.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytes;
}

/** True when the clip is effectively silent, so the person is told instead of waiting for an empty answer. */
export function isSilent(samples: Float32Array, threshold = 0.01): boolean {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  return peak < threshold;
}
