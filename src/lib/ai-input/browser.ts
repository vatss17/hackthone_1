"use client";

import { AUDIO_LIMITS, IMAGE_LIMITS } from "./upload";
import { downmix, encodeWav, isSilent, resample } from "./wav";

/** Browser-only helpers for the camera/file picker and the microphone. Nothing here sends anything anywhere. */

/** Shrinks a photo to at most 1600 px and re-encodes it as JPEG. This keeps uploads small and also drops EXIF data such as GPS and the camera's file name. */
export async function prepareImage(file: File): Promise<{ file: File } | { error: "too_large" | "unreadable" }> {
  if (file.type === "application/pdf") return file.size <= IMAGE_LIMITS.maxPdfBytes ? { file } : { error: "too_large" };
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return { error: "unreadable" };
    if (blob.size > IMAGE_LIMITS.maxBytes) return { error: "too_large" };
    return { file: new File([blob], "photo.jpg", { type: "image/jpeg" }) };
  } catch {
    // Some formats (for example HEIC outside Safari) cannot be decoded here. Send the original if it is small enough: the server decides.
    return file.size <= IMAGE_LIMITS.maxBytes ? { file: new File([file], "photo", { type: file.type }) } : { error: "too_large" };
  }
}

export type RecorderError = "unsupported" | "denied" | "no_device" | "failed";

export interface Recording {
  /** Stops at once and resolves with the clip. The microphone is released before this resolves. */
  stop(): Promise<{ wav: Blob; seconds: number; silent: boolean }>;
  /** Stops at once and throws the clip away. */
  cancel(): void;
}

export const recordingSupported = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

/**
 * Starts recording. The browser asks for microphone permission only now, because the person pressed the button. Recording ends when
 * stop() or cancel() is called, or after the time limit (onLimit fires), and the microphone is released immediately each time.
 */
export async function startRecording(onLimit: () => void): Promise<Recording> {
  if (!recordingSupported()) throw "unsupported" satisfies RecorderError;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    const name = (e as { name?: string })?.name;
    throw (name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "no_device" : "failed") satisfies RecorderError;
  }
  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream);
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const t0 = Date.now();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  const limit = setTimeout(onLimit, AUDIO_LIMITS.maxSeconds * 1000);
  rec.start();

  const finish = () =>
    new Promise<Blob>((resolve) => {
      clearTimeout(limit);
      if (rec.state === "inactive") {
        release();
        return resolve(new Blob(chunks, { type: rec.mimeType }));
      }
      rec.onstop = () => {
        release();
        resolve(new Blob(chunks, { type: rec.mimeType }));
      };
      rec.stop();
    });

  return {
    async stop() {
      const raw = await finish();
      const seconds = Math.min(AUDIO_LIMITS.maxSeconds, (Date.now() - t0) / 1000);
      const ctx = new AudioContext();
      try {
        const buf = await ctx.decodeAudioData(await raw.arrayBuffer());
        const mono = downmix(Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i)));
        const pcm = resample(mono, buf.sampleRate);
        const clipped = pcm.length > AUDIO_LIMITS.maxSeconds * 16000 ? pcm.slice(0, AUDIO_LIMITS.maxSeconds * 16000) : pcm;
        return { wav: new Blob([encodeWav(clipped) as BlobPart], { type: "audio/wav" }), seconds, silent: isSilent(clipped) };
      } finally {
        void ctx.close();
      }
    },
    cancel() {
      clearTimeout(limit);
      try {
        if (rec.state !== "inactive") rec.stop();
      } catch {
        /* already stopped */
      }
      release();
    },
  };
}

// ---- the browser's own speech recognition, used only when the server's AI is not available ----

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type Ctor = new () => SpeechRecognitionLike;
const speechCtor = (): Ctor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
export const browserSpeechSupported = () => speechCtor() !== null;

export interface BrowserSpeech {
  stop(): void;
  cancel(): void;
}

/** One utterance at a time (not continuous listening). `onText` receives the running transcript, `onEnd` fires once when recognition has stopped. */
export function startBrowserSpeech(lang: string, onText: (t: string, final: boolean) => void, onEnd: (error: string | null) => void): BrowserSpeech {
  const Ctor = speechCtor();
  if (!Ctor) {
    queueMicrotask(() => onEnd("unsupported"));
    return { stop() {}, cancel() {} };
  }
  const r = new Ctor();
  r.lang = lang;
  r.interimResults = true;
  r.continuous = false;
  let error: string | null = null;
  r.onresult = (e) => {
    const parts = Array.from(e.results as ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>);
    onText(parts.map((x) => x[0].transcript).join(" ").trim(), parts.every((x) => x.isFinal));
  };
  r.onerror = (e) => {
    error = e.error;
  };
  r.onend = () => onEnd(error);
  r.start();
  return { stop: () => r.stop(), cancel: () => r.abort() };
}
