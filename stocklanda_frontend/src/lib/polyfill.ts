import { Buffer } from "buffer";

declare global {
  var Buffer: typeof import("buffer").Buffer;
}

if (typeof globalThis !== "undefined" && !(globalThis as { Buffer?: unknown }).Buffer) {
  (globalThis as { Buffer: typeof Buffer }).Buffer = Buffer;
}

export {};
