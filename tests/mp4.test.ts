import assert from "node:assert/strict";
import test from "node:test";
import { inspectMp4, Mp4ValidationError } from "../lib/mp4";

function concat(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function u16(value: number): Uint8Array {
  return Uint8Array.of((value >>> 8) & 0xff, value & 0xff);
}

function u32(value: number): Uint8Array {
  return Uint8Array.of(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  );
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function box(type: string, payload: Uint8Array = new Uint8Array()): Uint8Array {
  return concat(u32(8 + payload.length), text(type), payload);
}

function descriptor(tag: number, payload: Uint8Array): Uint8Array {
  assert.ok(payload.length < 128, "test descriptor helper only supports one-byte lengths");
  return concat(Uint8Array.of(tag, payload.length), payload);
}

function movieHeader(timescale = 1_000, duration = 10_000): Uint8Array {
  return box(
    "mvhd",
    concat(
      Uint8Array.of(0, 0, 0, 0),
      u32(0),
      u32(0),
      u32(timescale),
      u32(duration)
    )
  );
}

function visualSampleEntry(type: string, labelOnly = false): Uint8Array {
  if (labelOnly) return box(type);
  const header = new Uint8Array(78);
  header.set(u16(1), 6);
  header.set(u16(640), 24);
  header.set(u16(360), 26);
  header.set(u16(1), 40);
  header.set(u16(0x18), 74);
  header.set(u16(0xffff), 76);
  const avcC = box(
    "avcC",
    Uint8Array.of(
      1,
      0x64,
      0,
      0x1f,
      0xff,
      0xe1,
      0,
      4,
      0x67,
      0x64,
      0,
      0x1f,
      1,
      0,
      2,
      0x68,
      0xee
    )
  );
  return box(type, concat(header, avcC));
}

function audioSampleEntry(type: string, labelOnly = false): Uint8Array {
  if (labelOnly) return box(type);
  const header = new Uint8Array(28);
  header.set(u16(1), 6);
  header.set(u16(2), 16);
  header.set(u16(16), 18);
  header.set(u32(48_000 * 0x10000), 24);

  const audioSpecificConfig = descriptor(0x05, Uint8Array.of(0x12, 0x10));
  const decoderConfig = descriptor(
    0x04,
    concat(
      Uint8Array.of(0x40, 0x15),
      Uint8Array.of(0, 0, 0),
      u32(128_000),
      u32(128_000),
      audioSpecificConfig
    )
  );
  const elementaryStream = descriptor(
    0x03,
    concat(u16(1), Uint8Array.of(0), decoderConfig, descriptor(0x06, Uint8Array.of(2)))
  );
  const esds = box("esds", concat(Uint8Array.of(0, 0, 0, 0), elementaryStream));
  return box(type, concat(header, esds));
}

function track(
  handler: "vide" | "soun",
  sampleType: string,
  chunkOffset: number,
  sampleSize: number,
  labelOnly = false
): Uint8Array {
  const hdlr = box("hdlr", concat(Uint8Array.of(0, 0, 0, 0), u32(0), text(handler)));
  const sampleEntry =
    handler === "vide"
      ? visualSampleEntry(sampleType, labelOnly)
      : audioSampleEntry(sampleType, labelOnly);
  const stsd = box("stsd", concat(Uint8Array.of(0, 0, 0, 0), u32(1), sampleEntry));
  const stts = box(
    "stts",
    concat(Uint8Array.of(0, 0, 0, 0), u32(1), u32(1), u32(1_000))
  );
  const stsc = box(
    "stsc",
    concat(Uint8Array.of(0, 0, 0, 0), u32(1), u32(1), u32(1), u32(1))
  );
  const stsz = box(
    "stsz",
    concat(Uint8Array.of(0, 0, 0, 0), u32(sampleSize), u32(1))
  );
  const stco = box(
    "stco",
    concat(Uint8Array.of(0, 0, 0, 0), u32(1), u32(chunkOffset))
  );
  const stbl = box("stbl", concat(stsd, stts, stsc, stsz, stco));
  const minf = box("minf", stbl);
  return box("trak", box("mdia", concat(hdlr, minf)));
}

interface Mp4Options {
  video?: string;
  audio?: string;
  labelOnlyVideo?: boolean;
  labelOnlyAudio?: boolean;
  chunkOffsetAdjustment?: number;
}

function validMp4({
  video = "avc1",
  audio = "mp4a",
  labelOnlyVideo = false,
  labelOnlyAudio = false,
  chunkOffsetAdjustment = 0,
}: Mp4Options = {}): Uint8Array {
  const ftyp = box("ftyp", concat(text("isom"), u32(0), text("isomavc1")));
  const placeholderMoov = box(
    "moov",
    concat(
      movieHeader(),
      track("vide", video, 0, 4, labelOnlyVideo),
      track("soun", audio, 0, 4, labelOnlyAudio)
    )
  );
  const mediaStart = ftyp.length + placeholderMoov.length + 8 + chunkOffsetAdjustment;
  const moov = box(
    "moov",
    concat(
      movieHeader(),
      track("vide", video, mediaStart, 4, labelOnlyVideo),
      track("soun", audio, mediaStart + 4, 4, labelOnlyAudio)
    )
  );
  assert.equal(moov.length, placeholderMoov.length);
  return concat(ftyp, moov, box("mdat", Uint8Array.of(0x65, 1, 2, 3, 4, 5, 6, 7)));
}

test("fast-start H.264/AAC MP4 structure is validated from the movie header", () => {
  assert.deepEqual(inspectMp4(validMp4()), {
    durationMs: 10_000,
    videoCodec: "h264",
    audioCodec: "aac",
    fastStart: true,
  });
});

test("media data before the movie header is rejected as non-fast-start", () => {
  const file = validMp4();
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const ftypSize = view.getUint32(0);
  const moovSize = view.getUint32(ftypSize);
  const ftyp = file.slice(0, ftypSize);
  const moov = file.slice(ftypSize, ftypSize + moovSize);
  const mdat = file.slice(ftypSize + moovSize);
  assert.throws(() => inspectMp4(concat(ftyp, mdat, moov)), Mp4ValidationError);
});

test("unsupported video and audio sample entries are rejected", () => {
  assert.throws(() => inspectMp4(validMp4({ video: "hvc1" })), /H\.264/);
  assert.throws(() => inspectMp4(validMp4({ audio: "Opus" })), /AAC/);
});

test("codec labels without decoder configuration and sample-entry structure fail closed", () => {
  assert.throws(
    () => inspectMp4(validMp4({ labelOnlyVideo: true })),
    /visual sample entry|truncated/i
  );
  assert.throws(
    () => inspectMp4(validMp4({ labelOnlyAudio: true })),
    /audio sample entry|truncated/i
  );
});

test("sample tables cannot point outside the media-data box", () => {
  assert.throws(
    () => inspectMp4(validMp4({ chunkOffsetAdjustment: 8 })),
    /outside the media-data box/
  );
});

test("a prefix that truncates the movie header fails closed", () => {
  const file = validMp4();
  assert.throws(() => inspectMp4(file.slice(0, 40), file.length), /not fully available|truncated/);
});
