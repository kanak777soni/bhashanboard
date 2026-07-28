export interface InspectedMp4 {
  durationMs: number;
  videoCodec: "h264";
  audioCodec: "aac";
  fastStart: true;
}

export class Mp4ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Mp4ValidationError";
  }
}

interface Mp4Box {
  type: string;
  start: number;
  headerSize: number;
  payloadStart: number;
  end: number;
}

interface Descriptor {
  tag: number;
  payloadStart: number;
  end: number;
}

interface SampleSizeTable {
  sampleCount: number;
  totalBytes: number;
  sizeAt: (index: number) => number;
}

interface SampleToChunkEntry {
  firstChunk: number;
  samplesPerChunk: number;
  sampleDescriptionIndex: number;
}

const decoder = new TextDecoder("latin1");
const MAX_TABLE_ENTRIES = 1_000_000;

function fail(message: string): never {
  throw new Mp4ValidationError(message);
}

function requireBytes(bytes: Uint8Array, offset: number, length: number, label: string): void {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset + length > bytes.length
  ) {
    fail(`The MP4 ${label} is truncated.`);
  }
}

function requireWithin(
  bytes: Uint8Array,
  box: Mp4Box,
  offset: number,
  length: number,
  label: string
): void {
  if (offset < box.payloadStart || offset + length > box.end) {
    fail(`The MP4 ${label} is truncated.`);
  }
  requireBytes(bytes, offset, length, label);
}

function uint16(bytes: Uint8Array, offset: number, label = "box"): number {
  requireBytes(bytes, offset, 2, label);
  return bytes[offset] * 0x100 + bytes[offset + 1];
}

function uint32(bytes: Uint8Array, offset: number, label = "box"): number {
  requireBytes(bytes, offset, 4, label);
  return (
    bytes[offset] * 0x1000000 +
    bytes[offset + 1] * 0x10000 +
    bytes[offset + 2] * 0x100 +
    bytes[offset + 3]
  );
}

function uint64(bytes: Uint8Array, offset: number, label = "box"): number {
  const high = uint32(bytes, offset, label);
  const low = uint32(bytes, offset + 4, label);
  const value = high * 0x100000000 + low;
  if (!Number.isSafeInteger(value)) fail(`The MP4 ${label} is too large to validate safely.`);
  return value;
}

function safeAdd(left: number, right: number, label: string): number {
  const value = left + right;
  if (!Number.isSafeInteger(value)) fail(`The MP4 ${label} is too large to validate safely.`);
  return value;
}

function safeMultiply(left: number, right: number, label: string): number {
  const value = left * right;
  if (!Number.isSafeInteger(value)) fail(`The MP4 ${label} is too large to validate safely.`);
  return value;
}

function ascii(bytes: Uint8Array, offset: number, length: number, label = "box"): string {
  requireBytes(bytes, offset, length, label);
  return decoder.decode(bytes.subarray(offset, offset + length));
}

function boxAt(
  bytes: Uint8Array,
  offset: number,
  boundary: number,
  allowTruncatedPayload = false
): Mp4Box {
  requireBytes(bytes, offset, 8, "box header");
  let size = uint32(bytes, offset, "box size");
  const type = ascii(bytes, offset + 4, 4, "box type");
  let headerSize = 8;
  if (size === 1) {
    requireBytes(bytes, offset + 8, 8, "extended box size");
    size = uint64(bytes, offset + 8, "extended box size");
    headerSize = 16;
  } else if (size === 0) {
    size = boundary - offset;
  }
  if (size < headerSize) fail(`The MP4 ${type} box has an invalid size.`);
  const end = offset + size;
  if (!Number.isSafeInteger(end) || end > boundary) {
    fail(`The MP4 ${type} box extends beyond the file.`);
  }
  if (!allowTruncatedPayload && end > bytes.length) {
    fail(`The MP4 ${type} box is not fully available near the beginning of the file.`);
  }
  return { type, start: offset, headerSize, payloadStart: offset + headerSize, end };
}

function boxesBetween(bytes: Uint8Array, start: number, end: number): Mp4Box[] {
  const boxes: Mp4Box[] = [];
  let offset = start;
  while (offset < end) {
    const box = boxAt(bytes, offset, end);
    boxes.push(box);
    offset = box.end;
  }
  return boxes;
}

function childBoxes(bytes: Uint8Array, parent: Mp4Box): Mp4Box[] {
  return boxesBetween(bytes, parent.payloadStart, parent.end);
}

function child(bytes: Uint8Array, parent: Mp4Box, type: string): Mp4Box | undefined {
  return childBoxes(bytes, parent).find((box) => box.type === type);
}

function requiredChild(bytes: Uint8Array, parent: Mp4Box, type: string): Mp4Box {
  return child(bytes, parent, type) ?? fail(`The MP4 is missing its ${type} box.`);
}

function movieDurationMs(bytes: Uint8Array, moov: Mp4Box): number {
  const mvhd = requiredChild(bytes, moov, "mvhd");
  requireWithin(bytes, mvhd, mvhd.payloadStart, 20, "movie header");
  const version = bytes[mvhd.payloadStart];
  let timescale: number;
  let duration: number;
  if (version === 0) {
    timescale = uint32(bytes, mvhd.payloadStart + 12, "movie timescale");
    duration = uint32(bytes, mvhd.payloadStart + 16, "movie duration");
  } else if (version === 1) {
    requireWithin(bytes, mvhd, mvhd.payloadStart, 32, "version 1 movie header");
    timescale = uint32(bytes, mvhd.payloadStart + 20, "movie timescale");
    duration = uint64(bytes, mvhd.payloadStart + 24, "movie duration");
  } else {
    fail("The MP4 uses an unsupported movie-header version.");
  }
  if (timescale <= 0 || duration <= 0) fail("The MP4 has an invalid duration.");
  const durationMs = Math.round((duration * 1000) / timescale);
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) {
    fail("The MP4 duration cannot be represented safely.");
  }
  return durationMs;
}

function handlerType(bytes: Uint8Array, mdia: Mp4Box): string {
  const hdlr = requiredChild(bytes, mdia, "hdlr");
  requireWithin(bytes, hdlr, hdlr.payloadStart, 12, "track handler");
  return ascii(bytes, hdlr.payloadStart + 8, 4, "track handler");
}

function parseAvcConfiguration(bytes: Uint8Array, avcC: Mp4Box): void {
  requireWithin(bytes, avcC, avcC.payloadStart, 7, "AVC configuration");
  const start = avcC.payloadStart;
  if (bytes[start] !== 1 || bytes[start + 1] === 0 || bytes[start + 3] === 0) {
    fail("The MP4 has an invalid H.264 decoder configuration.");
  }
  if ((bytes[start + 4] & 0xfc) !== 0xfc || (bytes[start + 4] & 0x03) === 2) {
    fail("The MP4 has an invalid H.264 NAL-length configuration.");
  }
  if ((bytes[start + 5] & 0xe0) !== 0xe0) {
    fail("The MP4 has an invalid H.264 sequence-parameter declaration.");
  }

  const sequenceCount = bytes[start + 5] & 0x1f;
  if (sequenceCount < 1) fail("The MP4 H.264 track has no sequence parameter set.");
  let offset = start + 6;
  for (let index = 0; index < sequenceCount; index++) {
    if (offset + 2 > avcC.end) fail("The MP4 H.264 sequence parameters are truncated.");
    const length = uint16(bytes, offset, "H.264 sequence-parameter length");
    offset += 2;
    if (length < 1 || offset + length > avcC.end || (bytes[offset] & 0x1f) !== 7) {
      fail("The MP4 has an invalid H.264 sequence parameter set.");
    }
    offset += length;
  }

  if (offset >= avcC.end) fail("The MP4 H.264 picture parameters are truncated.");
  const pictureCount = bytes[offset++];
  if (pictureCount < 1) fail("The MP4 H.264 track has no picture parameter set.");
  for (let index = 0; index < pictureCount; index++) {
    if (offset + 2 > avcC.end) fail("The MP4 H.264 picture parameters are truncated.");
    const length = uint16(bytes, offset, "H.264 picture-parameter length");
    offset += 2;
    if (length < 1 || offset + length > avcC.end || (bytes[offset] & 0x1f) !== 8) {
      fail("The MP4 has an invalid H.264 picture parameter set.");
    }
    offset += length;
  }
}

function validateVisualSampleEntry(bytes: Uint8Array, entry: Mp4Box): void {
  requireWithin(bytes, entry, entry.payloadStart, 78, "H.264 visual sample entry");
  const start = entry.payloadStart;
  const dataReference = uint16(bytes, start + 6, "video data-reference index");
  const width = uint16(bytes, start + 24, "video width");
  const height = uint16(bytes, start + 26, "video height");
  const frameCount = uint16(bytes, start + 40, "video frame count");
  if (dataReference < 1 || width < 1 || height < 1 || frameCount < 1) {
    fail("The MP4 has an invalid H.264 visual sample entry.");
  }
  const avcC = boxesBetween(bytes, start + 78, entry.end).find((box) => box.type === "avcC");
  if (!avcC) fail("The MP4 H.264 sample entry is missing its avcC configuration.");
  parseAvcConfiguration(bytes, avcC);
}

function readDescriptor(bytes: Uint8Array, offset: number, boundary: number): Descriptor {
  if (offset >= boundary) fail("The MP4 AAC descriptor is truncated.");
  const tag = bytes[offset++];
  let length = 0;
  let complete = false;
  for (let count = 0; count < 4; count++) {
    if (offset >= boundary) fail("The MP4 AAC descriptor length is truncated.");
    const value = bytes[offset++];
    length = length * 128 + (value & 0x7f);
    if ((value & 0x80) === 0) {
      complete = true;
      break;
    }
  }
  if (!complete) fail("The MP4 AAC descriptor length is invalid.");
  const end = offset + length;
  if (!Number.isSafeInteger(end) || end > boundary) fail("The MP4 AAC descriptor is truncated.");
  return { tag, payloadStart: offset, end };
}

function descriptorsBetween(bytes: Uint8Array, start: number, end: number): Descriptor[] {
  const descriptors: Descriptor[] = [];
  let offset = start;
  while (offset < end) {
    const descriptor = readDescriptor(bytes, offset, end);
    descriptors.push(descriptor);
    offset = descriptor.end;
  }
  return descriptors;
}

function validateAudioSpecificConfig(bytes: Uint8Array, descriptor: Descriptor): void {
  if (descriptor.end - descriptor.payloadStart < 2) {
    fail("The MP4 AAC AudioSpecificConfig is truncated.");
  }
  let bitOffset = descriptor.payloadStart * 8;
  const bitEnd = descriptor.end * 8;
  const readBits = (count: number): number => {
    if (bitOffset + count > bitEnd) fail("The MP4 AAC AudioSpecificConfig is truncated.");
    let value = 0;
    for (let index = 0; index < count; index++) {
      value = value * 2 + ((bytes[Math.floor(bitOffset / 8)] >> (7 - (bitOffset % 8))) & 1);
      bitOffset++;
    }
    return value;
  };

  let audioObjectType = readBits(5);
  if (audioObjectType === 31) audioObjectType = 32 + readBits(6);
  const supportedAacTypes = new Set([1, 2, 3, 4, 5, 6, 17, 20, 23, 29, 39, 42]);
  if (!supportedAacTypes.has(audioObjectType)) {
    fail("The MP4 audio track does not declare a supported AAC object type.");
  }
  const samplingFrequencyIndex = readBits(4);
  if (samplingFrequencyIndex === 15) {
    if (readBits(24) < 1) fail("The MP4 AAC sampling frequency is invalid.");
  } else if (samplingFrequencyIndex > 12) {
    fail("The MP4 AAC sampling-frequency index is reserved.");
  }
  const channelConfiguration = readBits(4);
  if (channelConfiguration < 1 || channelConfiguration > 7) {
    fail("The MP4 AAC channel configuration is unsupported.");
  }
}

function validateEsDescriptor(bytes: Uint8Array, esds: Mp4Box): void {
  requireWithin(bytes, esds, esds.payloadStart, 5, "AAC elementary-stream descriptor");
  if (bytes[esds.payloadStart] !== 0) {
    fail("The MP4 uses an unsupported AAC descriptor version.");
  }
  const roots = descriptorsBetween(bytes, esds.payloadStart + 4, esds.end);
  const es = roots.find((descriptor) => descriptor.tag === 0x03);
  if (!es || es.end - es.payloadStart < 3) {
    fail("The MP4 AAC track is missing its elementary-stream descriptor.");
  }

  let offset = es.payloadStart + 2;
  const flags = bytes[offset++];
  if ((flags & 0x80) !== 0) offset += 2;
  if ((flags & 0x40) !== 0) {
    if (offset >= es.end) fail("The MP4 AAC URL descriptor is truncated.");
    offset += 1 + bytes[offset];
  }
  if ((flags & 0x20) !== 0) offset += 2;
  if (offset > es.end) fail("The MP4 AAC elementary-stream descriptor is truncated.");

  const decoderConfig = descriptorsBetween(bytes, offset, es.end).find(
    (descriptor) => descriptor.tag === 0x04
  );
  if (!decoderConfig || decoderConfig.end - decoderConfig.payloadStart < 13) {
    fail("The MP4 AAC track is missing its decoder configuration.");
  }
  const configStart = decoderConfig.payloadStart;
  const objectType = bytes[configStart];
  const streamType = bytes[configStart + 1] >> 2;
  if (![0x40, 0x66, 0x67, 0x68].includes(objectType) || streamType !== 5) {
    fail("The MP4 audio decoder configuration is not AAC.");
  }
  if ((bytes[configStart + 1] & 1) !== 1) {
    fail("The MP4 AAC decoder configuration has an invalid reserved bit.");
  }
  const decoderSpecific = descriptorsBetween(bytes, configStart + 13, decoderConfig.end).find(
    (descriptor) => descriptor.tag === 0x05
  );
  if (!decoderSpecific) fail("The MP4 AAC track is missing its AudioSpecificConfig.");
  validateAudioSpecificConfig(bytes, decoderSpecific);
}

function validateAudioSampleEntry(bytes: Uint8Array, entry: Mp4Box): void {
  requireWithin(bytes, entry, entry.payloadStart, 28, "AAC audio sample entry");
  const start = entry.payloadStart;
  const dataReference = uint16(bytes, start + 6, "audio data-reference index");
  const version = uint16(bytes, start + 8, "audio sample-entry version");
  const channels = uint16(bytes, start + 16, "audio channel count");
  const sampleSize = uint16(bytes, start + 18, "audio sample size");
  const sampleRate = uint32(bytes, start + 24, "audio sample rate") / 0x10000;
  if (
    dataReference < 1 ||
    version !== 0 ||
    channels < 1 ||
    channels > 8 ||
    sampleSize < 8 ||
    sampleRate < 8_000 ||
    sampleRate > 384_000
  ) {
    fail("The MP4 has an invalid AAC audio sample entry.");
  }
  const esds = boxesBetween(bytes, start + 28, entry.end).find((box) => box.type === "esds");
  if (!esds) fail("The MP4 AAC sample entry is missing its esds configuration.");
  validateEsDescriptor(bytes, esds);
}

function parseSampleDescriptions(
  bytes: Uint8Array,
  stbl: Mp4Box,
  handler: "vide" | "soun"
): { entryCount: number; supportedEntryIndexes: Set<number> } {
  const stsd = requiredChild(bytes, stbl, "stsd");
  requireWithin(bytes, stsd, stsd.payloadStart, 8, "sample description");
  const entryCount = uint32(bytes, stsd.payloadStart + 4, "sample-entry count");
  if (entryCount < 1 || entryCount > 32) fail("The MP4 has an invalid sample-entry count.");

  const supportedEntryIndexes = new Set<number>();
  let offset = stsd.payloadStart + 8;
  for (let index = 1; index <= entryCount; index++) {
    const entry = boxAt(bytes, offset, stsd.end);
    if (handler === "vide" && (entry.type === "avc1" || entry.type === "avc3")) {
      validateVisualSampleEntry(bytes, entry);
      supportedEntryIndexes.add(index);
    }
    if (handler === "soun" && entry.type === "mp4a") {
      validateAudioSampleEntry(bytes, entry);
      supportedEntryIndexes.add(index);
    }
    offset = entry.end;
  }
  if (offset !== stsd.end) fail("The MP4 sample-description table has trailing data.");
  return { entryCount, supportedEntryIndexes };
}

function parseTimeToSample(bytes: Uint8Array, stbl: Mp4Box): number {
  const stts = requiredChild(bytes, stbl, "stts");
  requireWithin(bytes, stts, stts.payloadStart, 8, "time-to-sample table");
  const entryCount = uint32(bytes, stts.payloadStart + 4, "time-to-sample entry count");
  if (entryCount < 1 || entryCount > MAX_TABLE_ENTRIES) {
    fail("The MP4 has an invalid time-to-sample entry count.");
  }
  requireWithin(bytes, stts, stts.payloadStart + 8, entryCount * 8, "time-to-sample entries");
  let sampleCount = 0;
  for (let index = 0; index < entryCount; index++) {
    const offset = stts.payloadStart + 8 + index * 8;
    const count = uint32(bytes, offset, "time-to-sample count");
    const delta = uint32(bytes, offset + 4, "time-to-sample delta");
    if (count < 1 || delta < 1) fail("The MP4 has an invalid time-to-sample entry.");
    sampleCount = safeAdd(sampleCount, count, "sample count");
    if (sampleCount > MAX_TABLE_ENTRIES) fail("The MP4 has too many media samples.");
  }
  return sampleCount;
}

function parseSampleSizes(bytes: Uint8Array, stbl: Mp4Box): SampleSizeTable {
  const stsz = requiredChild(bytes, stbl, "stsz");
  requireWithin(bytes, stsz, stsz.payloadStart, 12, "sample-size table");
  const constantSize = uint32(bytes, stsz.payloadStart + 4, "constant sample size");
  const sampleCount = uint32(bytes, stsz.payloadStart + 8, "sample-size count");
  if (sampleCount < 1 || sampleCount > MAX_TABLE_ENTRIES) {
    fail("The MP4 has an invalid sample-size count.");
  }
  if (constantSize > 0) {
    return {
      sampleCount,
      totalBytes: safeMultiply(constantSize, sampleCount, "sample data"),
      sizeAt: () => constantSize,
    };
  }

  const sizesStart = stsz.payloadStart + 12;
  requireWithin(bytes, stsz, sizesStart, sampleCount * 4, "sample sizes");
  let totalBytes = 0;
  for (let index = 0; index < sampleCount; index++) {
    const size = uint32(bytes, sizesStart + index * 4, "sample size");
    if (size < 1) fail("The MP4 contains an empty media sample.");
    totalBytes = safeAdd(totalBytes, size, "sample data");
  }
  return {
    sampleCount,
    totalBytes,
    sizeAt: (index) => uint32(bytes, sizesStart + index * 4, "sample size"),
  };
}

function parseSampleToChunk(bytes: Uint8Array, stbl: Mp4Box): SampleToChunkEntry[] {
  const stsc = requiredChild(bytes, stbl, "stsc");
  requireWithin(bytes, stsc, stsc.payloadStart, 8, "sample-to-chunk table");
  const entryCount = uint32(bytes, stsc.payloadStart + 4, "sample-to-chunk entry count");
  if (entryCount < 1 || entryCount > MAX_TABLE_ENTRIES) {
    fail("The MP4 has an invalid sample-to-chunk entry count.");
  }
  requireWithin(bytes, stsc, stsc.payloadStart + 8, entryCount * 12, "sample-to-chunk entries");
  const entries: SampleToChunkEntry[] = [];
  for (let index = 0; index < entryCount; index++) {
    const offset = stsc.payloadStart + 8 + index * 12;
    const entry = {
      firstChunk: uint32(bytes, offset, "first chunk"),
      samplesPerChunk: uint32(bytes, offset + 4, "samples per chunk"),
      sampleDescriptionIndex: uint32(bytes, offset + 8, "sample-description index"),
    };
    if (
      entry.firstChunk < 1 ||
      entry.samplesPerChunk < 1 ||
      entry.sampleDescriptionIndex < 1 ||
      (index === 0 && entry.firstChunk !== 1) ||
      (index > 0 && entry.firstChunk <= entries[index - 1].firstChunk)
    ) {
      fail("The MP4 has an invalid sample-to-chunk mapping.");
    }
    entries.push(entry);
  }
  return entries;
}

function parseChunkOffsets(bytes: Uint8Array, stbl: Mp4Box): number[] {
  const stco = child(bytes, stbl, "stco");
  const co64 = child(bytes, stbl, "co64");
  if ((stco && co64) || (!stco && !co64)) {
    fail("The MP4 must contain exactly one chunk-offset table.");
  }
  const table = stco ?? co64!;
  const width = table.type === "co64" ? 8 : 4;
  requireWithin(bytes, table, table.payloadStart, 8, "chunk-offset table");
  const entryCount = uint32(bytes, table.payloadStart + 4, "chunk-offset entry count");
  if (entryCount < 1 || entryCount > MAX_TABLE_ENTRIES) {
    fail("The MP4 has an invalid chunk-offset count.");
  }
  requireWithin(bytes, table, table.payloadStart + 8, entryCount * width, "chunk offsets");
  const offsets: number[] = [];
  for (let index = 0; index < entryCount; index++) {
    const offset = table.payloadStart + 8 + index * width;
    const value = width === 8 ? uint64(bytes, offset, "64-bit chunk offset") : uint32(bytes, offset, "chunk offset");
    if (index > 0 && value <= offsets[index - 1]) {
      fail("The MP4 chunk offsets are not strictly increasing.");
    }
    offsets.push(value);
  }
  return offsets;
}

function validateSampleTable(
  bytes: Uint8Array,
  stbl: Mp4Box,
  supportedEntryIndexes: Set<number>,
  entryCount: number,
  mdat: Mp4Box
): number {
  const timedSampleCount = parseTimeToSample(bytes, stbl);
  const sampleSizes = parseSampleSizes(bytes, stbl);
  if (timedSampleCount !== sampleSizes.sampleCount) {
    fail("The MP4 sample timing and size tables disagree.");
  }
  const sampleToChunk = parseSampleToChunk(bytes, stbl);
  const chunkOffsets = parseChunkOffsets(bytes, stbl);
  if (sampleToChunk[sampleToChunk.length - 1].firstChunk > chunkOffsets.length) {
    fail("The MP4 sample-to-chunk table references a missing chunk.");
  }

  let mappingIndex = 0;
  let sampleIndex = 0;
  for (let chunkIndex = 1; chunkIndex <= chunkOffsets.length; chunkIndex++) {
    while (
      mappingIndex + 1 < sampleToChunk.length &&
      sampleToChunk[mappingIndex + 1].firstChunk <= chunkIndex
    ) {
      mappingIndex++;
    }
    const mapping = sampleToChunk[mappingIndex];
    if (
      mapping.sampleDescriptionIndex > entryCount ||
      !supportedEntryIndexes.has(mapping.sampleDescriptionIndex)
    ) {
      fail("The MP4 media samples reference an unsupported codec description.");
    }

    let chunkBytes = 0;
    for (let index = 0; index < mapping.samplesPerChunk; index++) {
      if (sampleIndex >= sampleSizes.sampleCount) {
        fail("The MP4 sample-to-chunk table references too many samples.");
      }
      chunkBytes = safeAdd(chunkBytes, sampleSizes.sizeAt(sampleIndex++), "chunk data");
    }
    const chunkStart = chunkOffsets[chunkIndex - 1];
    const chunkEnd = safeAdd(chunkStart, chunkBytes, "chunk boundary");
    if (chunkStart < mdat.payloadStart || chunkEnd > mdat.end) {
      fail("The MP4 media sample points outside the media-data box.");
    }
    if (chunkIndex < chunkOffsets.length && chunkEnd > chunkOffsets[chunkIndex]) {
      fail("The MP4 media chunks overlap.");
    }
  }
  if (sampleIndex !== sampleSizes.sampleCount) {
    fail("The MP4 sample-to-chunk table does not cover every media sample.");
  }
  return sampleSizes.totalBytes;
}

function validateTrack(
  bytes: Uint8Array,
  mdia: Mp4Box,
  handler: "vide" | "soun",
  mdat: Mp4Box
): number | undefined {
  const minf = requiredChild(bytes, mdia, "minf");
  const stbl = requiredChild(bytes, minf, "stbl");
  const descriptions = parseSampleDescriptions(bytes, stbl, handler);
  if (descriptions.supportedEntryIndexes.size === 0) return undefined;
  return validateSampleTable(
    bytes,
    stbl,
    descriptions.supportedEntryIndexes,
    descriptions.entryCount,
    mdat
  );
}

/**
 * Validate a progressive browser-ready MP4 from a prefix containing the full
 * `moov` box and the following `mdat` header. Besides codec declarations, this
 * verifies AVC/AAC decoder configuration and that timing, sample-size,
 * sample-to-chunk, and chunk-offset tables consistently describe non-empty
 * media inside `mdat`. This is structural validation, not a full media decode.
 */
export function inspectMp4(bytes: Uint8Array, fileSize = bytes.length): InspectedMp4 {
  if (!(bytes instanceof Uint8Array) || bytes.length < 24) {
    fail("The uploaded file is too small to be a valid MP4.");
  }
  if (!Number.isSafeInteger(fileSize) || fileSize < bytes.length) {
    fail("The MP4 file size is invalid.");
  }

  let offset = 0;
  let firstBox = true;
  let moov: Mp4Box | undefined;
  let mdat: Mp4Box | undefined;
  while (offset < bytes.length) {
    requireBytes(bytes, offset, 8, "top-level box header");
    const type = ascii(bytes, offset + 4, 4, "top-level box type");
    const box = boxAt(bytes, offset, fileSize, type === "mdat");
    if (firstBox && box.type !== "ftyp") {
      fail("The file does not begin with an MP4 file-type box.");
    }
    firstBox = false;
    if (box.type === "mdat") {
      mdat = box;
      if (!moov) fail("The MP4 is not fast-start optimized (`moov` follows media data).");
      break;
    }
    if (box.type === "moov") {
      if (moov) fail("The MP4 contains more than one movie box.");
      moov = box;
    }
    offset = box.end;
  }

  if (!moov) fail("The MP4 header does not contain a complete `moov` box.");
  if (!mdat || mdat.end <= mdat.payloadStart) {
    fail("The MP4 header does not contain a non-empty media-data box.");
  }

  let videoBytes: number | undefined;
  let audioBytes: number | undefined;
  for (const trak of childBoxes(bytes, moov).filter((box) => box.type === "trak")) {
    const mdia = requiredChild(bytes, trak, "mdia");
    const handler = handlerType(bytes, mdia);
    if (handler === "vide") {
      const validatedBytes = validateTrack(bytes, mdia, "vide", mdat);
      if (validatedBytes !== undefined) videoBytes = safeAdd(videoBytes ?? 0, validatedBytes, "video data");
    }
    if (handler === "soun") {
      const validatedBytes = validateTrack(bytes, mdia, "soun", mdat);
      if (validatedBytes !== undefined) audioBytes = safeAdd(audioBytes ?? 0, validatedBytes, "audio data");
    }
  }
  if (!videoBytes) fail("The MP4 video track must use H.264 (avc1/avc3).");
  if (!audioBytes) fail("The MP4 audio track must use AAC (mp4a).");
  if (safeAdd(videoBytes, audioBytes, "media data") > mdat.end - mdat.payloadStart) {
    fail("The MP4 sample tables exceed the media-data box.");
  }

  return {
    durationMs: movieDurationMs(bytes, moov),
    videoCodec: "h264",
    audioCodec: "aac",
    fastStart: true,
  };
}
