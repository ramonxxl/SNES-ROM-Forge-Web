import { test } from "node:test";
import assert from "node:assert/strict";
import { fixChecksum, isChecksumValid, readChecksumPair } from "../src/core/checksum.js";
import { SNESRom } from "../src/core/rom.js";
import { merge } from "../src/core/merger.js";
import { ValidationError } from "../src/core/validator.js";

function makeRom(name, mapping, size) {
  const headerOffset = mapping === "lorom" ? 0x7fc0 : 0xffc0;
  const data = new Uint8Array(size).fill(0xab);
  const fixed = fixChecksum(data, headerOffset);
  const { checksum, complement } = readChecksumPair(fixed, headerOffset);

  return new SNESRom({
    filename: name,
    rawData: fixed,
    data: fixed,
    hasSmcHeader: false,
    mapping,
    headerOffset,
    title: "GAME",
    checksumValue: checksum,
    complement,
    checksumValid: true,
    romSizeBytes: fixed.length,
  });
}

test("merge with 4 roms uses 1mb slots in 4mb flash", () => {
  const roms = [
    makeRom("small.sfc", "lorom", 0x8000),
    makeRom("exact.sfc", "lorom", 0x100000),
    makeRom("g3.sfc", "lorom", 0x90000),
    makeRom("g4.sfc", "lorom", 0x100000),
  ];
  const flash = { name: "29L3211", capacityBytes: 4 * 1024 * 1024 };

  const { data, report } = merge(roms, flash);

  assert.deepEqual(report.slotSizes, [0x100000, 0x100000, 0x100000, 0x100000]);
  const offsets = report.romOffsets.map(([, offset]) => offset);
  assert.deepEqual(offsets, [0, 0x100000, 0x200000, 0x300000]);
  assert.equal(report.paddingSize, 0);
  assert.equal(data.length, flash.capacityBytes);

  const tail = data.subarray(0x8000, 0x100000);
  assert.ok(tail.every((b) => b === 0xff));

  for (const [rom, [, offset, size]] of roms.map((r, i) => [r, report.romOffsets[i]])) {
    assert.ok(isChecksumValid(data.subarray(offset, offset + size), rom.headerOffset));
  }
});

test("merge matches user scenario: two 2mb games fill 4mb flash", () => {
  const roms = [makeRom("gameA.sfc", "lorom", 0x180000), makeRom("gameB.sfc", "lorom", 0x190000)];
  const flash = { name: "29L3211", capacityBytes: 4 * 1024 * 1024 };

  const { data, report } = merge(roms, flash);

  assert.deepEqual(report.slotSizes, [2 * 1024 * 1024, 2 * 1024 * 1024]);
  assert.equal(report.slotSizes.reduce((a, b) => a + b, 0), flash.capacityBytes);
  assert.equal(report.paddingSize, 0);
  assert.equal(data.length, flash.capacityBytes);
});

test("merge with 3 roms expands one to avoid a floating address", () => {
  const roms = [makeRom("g0.sfc", "lorom", 0x100000), makeRom("g1.sfc", "lorom", 0x100000), makeRom("g2.sfc", "lorom", 0x100000)];
  const flash = { name: "29L3211", capacityBytes: 4 * 1024 * 1024 };

  const { data, report } = merge(roms, flash);

  assert.deepEqual(report.slotSizes, [0x200000, 0x100000, 0x100000]);
  const offsets = report.romOffsets.map(([, offset]) => offset);
  assert.deepEqual(offsets, [0, 0x200000, 0x300000]);
  assert.equal(report.paddingSize, 0);
  assert.equal(data.length, flash.capacityBytes);

  const [, , rom0Size] = report.romOffsets[0];
  const firstHalf = data.subarray(0, rom0Size);
  const secondHalf = data.subarray(0x100000, 0x100000 + rom0Size);
  assert.deepEqual(firstHalf, secondHalf);
  assert.ok(isChecksumValid(secondHalf, roms[0].headerOffset));
});

test("merge blocks rom bigger than computed slot", () => {
  const roms = [makeRom("g0.sfc", "lorom", 0x180000), makeRom("g1.sfc", "lorom", 0x180000), makeRom("g2.sfc", "lorom", 0x180000)];
  const flash = { name: "29L3211", capacityBytes: 4 * 1024 * 1024 };

  assert.throws(() => merge(roms, flash), ValidationError);
});

test("merge blocks mixed mapping", () => {
  const lorom = makeRom("lo.sfc", "lorom", 0x8000);
  const hirom = makeRom("hi.sfc", "hirom", 0x10000);
  const flash = { name: "test-flash", capacityBytes: 4 * 1024 * 1024 };

  assert.throws(() => merge([lorom, hirom], flash), ValidationError);
});

test("merge blocks unknown mapping", () => {
  const rom = makeRom("lo.sfc", "lorom", 0x8000);
  rom.mapping = "unknown";
  const flash = { name: "test-flash", capacityBytes: 4 * 1024 * 1024 };

  assert.throws(() => merge([rom], flash), ValidationError);
});
