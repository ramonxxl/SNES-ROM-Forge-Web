import { test } from "node:test";
import assert from "node:assert/strict";
import { computeChecksum, fixChecksum, isChecksumValid, readChecksumPair } from "../src/core/checksum.js";

test("compute checksum excludes checksum bytes", () => {
  const data = new Uint8Array(32);
  for (let i = 0; i < 32; i++) data[i] = i;
  const headerOffset = 0;

  const result = computeChecksum(data, headerOffset);

  let expected = 0;
  for (let i = 0; i < 28; i++) expected += i;
  assert.equal(result, expected & 0xffff);
});

test("fix checksum produces consistent pair", () => {
  const headerOffset = 0x10;
  const data = new Uint8Array(1024);
  for (let i = 0; i < 1024; i++) data[i] = i % 256;
  data[headerOffset + 0x1c] = 0xaa;
  data[headerOffset + 0x1d] = 0xaa;
  data[headerOffset + 0x1e] = 0xbb;
  data[headerOffset + 0x1f] = 0xbb;

  const fixed = fixChecksum(data, headerOffset);

  assert.ok(isChecksumValid(fixed, headerOffset));
  const { checksum, complement } = readChecksumPair(fixed, headerOffset);
  assert.equal(checksum ^ complement, 0xffff);
});

test("fix checksum is idempotent", () => {
  const headerOffset = 0x10;
  const data = new Uint8Array(1024);
  for (let i = 0; i < 1024; i++) data[i] = i % 256;

  const once = fixChecksum(data, headerOffset);
  const twice = fixChecksum(once, headerOffset);

  assert.deepEqual(once, twice);
});

test("is checksum valid detects bad checksum", () => {
  const headerOffset = 0x10;
  const data = new Uint8Array(1024);
  for (let i = 0; i < 1024; i++) data[i] = i % 256;
  data[headerOffset + 0x1c] = 0;
  data[headerOffset + 0x1d] = 0;
  data[headerOffset + 0x1e] = 0;
  data[headerOffset + 0x1f] = 0;

  assert.equal(isChecksumValid(data, headerOffset), false);
});
