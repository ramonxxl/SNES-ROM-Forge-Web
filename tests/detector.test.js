import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, stripSmcHeader, LOROM_HEADER_OFFSET, HIROM_HEADER_OFFSET, MIN_DETECTION_SCORE } from "../src/core/detector.js";
import { fixChecksum } from "../src/core/checksum.js";

function buildValidRom(headerOffset, resetVectorOffset, totalSize, romSizeByte = 7) {
  const data = new Uint8Array(totalSize);

  const title = "TEST GAME".padEnd(21, " ");
  for (let i = 0; i < title.length; i++) data[headerOffset + i] = title.charCodeAt(i);

  data[headerOffset + 0x15] = 0x20; // map mode
  data[headerOffset + 0x16] = 0x00; // rom type
  data[headerOffset + 0x17] = romSizeByte;
  data[headerOffset + 0x18] = 0x00; // sram size
  data[headerOffset + 0x19] = 0x00; // country

  data[resetVectorOffset] = 0x00;
  data[resetVectorOffset + 1] = 0x80; // 0x8000: dentro da faixa válida

  return fixChecksum(data, headerOffset);
}

test("detects lorom", () => {
  const totalSize = 0x20000; // 128 KB, bate com rom_size_byte=7
  const data = buildValidRom(LOROM_HEADER_OFFSET, 0x7ffc, totalSize);

  const { mapping, candidate, scores } = detect(data);

  assert.equal(mapping, "lorom");
  assert.equal(candidate.headerOffset, LOROM_HEADER_OFFSET);
  assert.equal(candidate.title, "TEST GAME");
  assert.ok(scores.lorom > scores.hirom);
});

test("detects hirom", () => {
  const totalSize = 0x20000;
  const data = buildValidRom(HIROM_HEADER_OFFSET, 0xfffc, totalSize);

  const { mapping, candidate, scores } = detect(data);

  assert.equal(mapping, "hirom");
  assert.equal(candidate.headerOffset, HIROM_HEADER_OFFSET);
  assert.ok(scores.hirom > scores.lorom);
});

test("strips smc header", () => {
  const totalSize = 0x20000;
  const romData = buildValidRom(LOROM_HEADER_OFFSET, 0x7ffc, totalSize);
  const raw = new Uint8Array(512 + romData.length);
  raw.set(romData, 512);

  const { data, hasSmcHeader } = stripSmcHeader(raw);

  assert.equal(hasSmcHeader, true);
  assert.deepEqual(data, romData);
});

test("no smc header when size does not match", () => {
  const totalSize = 0x20000;
  const romData = buildValidRom(LOROM_HEADER_OFFSET, 0x7ffc, totalSize);

  const { data, hasSmcHeader } = stripSmcHeader(romData);

  assert.equal(hasSmcHeader, false);
  assert.deepEqual(data, romData);
});

test("unknown mapping for blank data", () => {
  const data = new Uint8Array(0x20000); // tudo zero: sem header válido em nenhum candidato

  const { mapping, candidate, scores } = detect(data);

  assert.equal(mapping, "unknown");
  assert.equal(candidate, null);
  assert.ok(scores.lorom < MIN_DETECTION_SCORE);
  assert.ok(scores.hirom < MIN_DETECTION_SCORE);
});
