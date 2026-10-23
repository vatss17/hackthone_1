/**
 * Checks for the files and audio clips sent to the AI endpoints. The declared type is never trusted: the first bytes decide.
 * Nothing here stores or logs a file.
 */

export type FileKind = "jpeg" | "png" | "webp" | "heic" | "pdf" | "wav" | "mp3" | "ogg" | "flac" | "aac";

export const MIME_OF: Record<FileKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
};

export const IMAGE_KINDS: FileKind[] = ["jpeg", "png", "webp", "heic"];
export const IMAGE_LIMITS = { maxBytes: 4_000_000, maxPdfBytes: 4_000_000 } as const;
export const AUDIO_LIMITS = { maxBytes: 3_000_000, maxSeconds: 60 } as const;

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

/** The real type of a file from its first bytes, or null when it is not a supported type. */
export function sniff(b: Uint8Array): FileKind | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && ascii(b, 1, 4) === "PNG") return "png";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WAVE") return "wav";
  if (ascii(b, 0, 5) === "%PDF-") return "pdf";
  if (ascii(b, 4, 8) === "ftyp" && /^(heic|heix|hevc|mif1|msf1)/.test(ascii(b, 8, 12))) return "heic";
  if (ascii(b, 0, 4) === "OggS") return "ogg";
  if (ascii(b, 0, 4) === "fLaC") return "flac";
  if (ascii(b, 0, 3) === "ID3") return "mp3";
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return "aac"; // ADTS frame: layer bits are zero
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) return "mp3";
  return null;
}

export type UploadCheck = { ok: true; kind: FileKind; mimeType: string } | { ok: false; reason: "empty" | "too_large" | "unsupported" };

export function checkImageUpload(bytes: Uint8Array, allowPdf: boolean): UploadCheck {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  const kind = sniff(bytes);
  if (!kind || !(IMAGE_KINDS.includes(kind) || (allowPdf && kind === "pdf"))) return { ok: false, reason: "unsupported" };
  if (bytes.length > (kind === "pdf" ? IMAGE_LIMITS.maxPdfBytes : IMAGE_LIMITS.maxBytes)) return { ok: false, reason: "too_large" };
  return { ok: true, kind, mimeType: MIME_OF[kind] };
}

export function checkAudioUpload(bytes: Uint8Array): UploadCheck {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  const kind = sniff(bytes);
  if (!kind || !["wav", "mp3", "ogg", "flac", "aac"].includes(kind)) return { ok: false, reason: "unsupported" };
  if (bytes.length > AUDIO_LIMITS.maxBytes) return { ok: false, reason: "too_large" };
  return { ok: true, kind, mimeType: MIME_OF[kind] };
}

export const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64");
