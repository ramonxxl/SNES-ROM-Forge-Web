/**
 * Detecção de header SMC (copier) e de mapeamento LoROM/HiROM de ROMs SNES.
 * Port direto de core/detector.py (mesmos offsets e heurística de pontuação).
 */

export const SMC_HEADER_SIZE = 512;

export const LOROM_HEADER_OFFSET = 0x7fc0;
export const HIROM_HEADER_OFFSET = 0xffc0;

const TITLE_OFFSET = 0x00;
const TITLE_SIZE = 21;
const ROM_SIZE_OFFSET = 0x17;
const COMPLEMENT_OFFSET = 0x1c;
const CHECKSUM_OFFSET = 0x1e;
const HEADER_BLOCK_SIZE = 0x40;

const RESET_VECTOR_OFFSET = {
  lorom: 0x7ffc,
  hirom: 0xfffc,
};

export const MIN_DETECTION_SCORE = 2;

/**
 * Remove o header SMC de 512 bytes, se presente.
 * @param {Uint8Array} raw
 * @returns {{ data: Uint8Array, hasSmcHeader: boolean }}
 */
export function stripSmcHeader(raw) {
  if (raw.length % 1024 === SMC_HEADER_SIZE) {
    return { data: raw.subarray(SMC_HEADER_SIZE), hasSmcHeader: true };
  }
  return { data: raw, hasSmcHeader: false };
}

function readU16LE(data, offset) {
  return data[offset] | (data[offset + 1] << 8);
}

function scoreCandidate(data, mapping) {
  const headerOffset = mapping === "lorom" ? LOROM_HEADER_OFFSET : HIROM_HEADER_OFFSET;
  if (data.length < headerOffset + HEADER_BLOCK_SIZE) {
    return null;
  }

  const titleBytes = data.subarray(headerOffset + TITLE_OFFSET, headerOffset + TITLE_OFFSET + TITLE_SIZE);
  const title = new TextDecoder("ascii").decode(titleBytes).replace(/[\x00 ]+$/, "").replace(/^[\x00 ]+/, "");
  const romSizeByte = data[headerOffset + ROM_SIZE_OFFSET];
  const complement = readU16LE(data, headerOffset + COMPLEMENT_OFFSET);
  const checksum = readU16LE(data, headerOffset + CHECKSUM_OFFSET);

  let score = 0;

  if ((checksum ^ complement) === 0xffff) {
    score += 2;
  }

  if (romSizeByte > 0 && romSizeByte < 32) {
    const expectedSize = (1 << romSizeByte) * 1024;
    if (data.length >= expectedSize * 0.5 && data.length <= expectedSize * 2) {
      score += 1;
    }
  }

  if (titleBytes.length > 0) {
    let printable = 0;
    for (const byte of titleBytes) {
      if (byte >= 0x20 && byte < 0x7f) printable += 1;
    }
    if (printable / titleBytes.length > 0.8) {
      score += 1;
    }
  }

  const resetVectorOffset = RESET_VECTOR_OFFSET[mapping];
  if (resetVectorOffset + 1 < data.length) {
    const resetVector = readU16LE(data, resetVectorOffset);
    if (resetVector >= 0x8000 && resetVector <= 0xffff) {
      score += 2;
    }
  }

  return { mapping, headerOffset, title, romSizeByte, complement, checksum, score };
}

/**
 * Detecta o mapeamento (LoROM/HiROM) de uma ROM já sem header SMC.
 * @param {Uint8Array} data
 * @returns {{ mapping: "lorom"|"hirom"|"unknown", candidate: object|null, scores: {lorom:number, hirom:number} }}
 */
export function detect(data) {
  const loromCandidate = scoreCandidate(data, "lorom");
  const hiromCandidate = scoreCandidate(data, "hirom");

  const scores = {
    lorom: loromCandidate ? loromCandidate.score : -1,
    hirom: hiromCandidate ? hiromCandidate.score : -1,
  };

  const bestMapping = scores.lorom >= scores.hirom ? "lorom" : "hirom";
  const bestScore = scores[bestMapping];

  if (bestScore < MIN_DETECTION_SCORE) {
    return { mapping: "unknown", candidate: null, scores };
  }

  const bestCandidate = bestMapping === "lorom" ? loromCandidate : hiromCandidate;
  return { mapping: bestMapping, candidate: bestCandidate, scores };
}
