/**
 * Cálculo e correção do checksum interno de uma ROM SNES.
 * Port direto de core/checksum.py.
 */

const COMPLEMENT_REL_OFFSET = 0x1c;
const CHECKSUM_REL_OFFSET = 0x1e;

/**
 * Soma todos os bytes de `data`, tratando os 4 bytes de checksum como zero.
 * Equivale a zerar esses 4 bytes antes de somar, mas evita a cópia: os bytes
 * são simplesmente excluídos da soma (contribuiriam com 0 de qualquer forma).
 * @param {Uint8Array} data
 * @param {number} headerOffset
 * @returns {number}
 */
export function computeChecksum(data, headerOffset) {
  const checksumStart = headerOffset + COMPLEMENT_REL_OFFSET;
  const checksumEnd = headerOffset + CHECKSUM_REL_OFFSET + 2;

  let total = 0;
  for (let i = 0; i < checksumStart; i++) total += data[i];
  for (let i = checksumEnd; i < data.length; i++) total += data[i];

  return total & 0xffff;
}

/**
 * Recalcula e regrava o checksum/complemento interno de uma ROM.
 * Usa sempre `headerOffset` (0x7FC0 para LoROM, 0xFFC0 para HiROM) do
 * mapeamento já detectado da ROM — nunca um offset fixo.
 * @param {Uint8Array} data
 * @param {number} headerOffset
 * @returns {Uint8Array}
 */
export function fixChecksum(data, headerOffset) {
  const checksum = computeChecksum(data, headerOffset);
  const complement = checksum ^ 0xffff;

  const fixed = new Uint8Array(data);
  const complementOffset = headerOffset + COMPLEMENT_REL_OFFSET;
  const checksumOffset = headerOffset + CHECKSUM_REL_OFFSET;

  fixed[complementOffset] = complement & 0xff;
  fixed[complementOffset + 1] = (complement >> 8) & 0xff;
  fixed[checksumOffset] = checksum & 0xff;
  fixed[checksumOffset + 1] = (checksum >> 8) & 0xff;

  return fixed;
}

/** Lê (checksum, complemento) já gravados na ROM, sem recalcular. */
export function readChecksumPair(data, headerOffset) {
  const complementOffset = headerOffset + COMPLEMENT_REL_OFFSET;
  const checksumOffset = headerOffset + CHECKSUM_REL_OFFSET;

  const complement = data[complementOffset] | (data[complementOffset + 1] << 8);
  const checksum = data[checksumOffset] | (data[checksumOffset + 1] << 8);
  return { checksum, complement };
}

/** Confere se o checksum gravado bate com o valor calculado da ROM. */
export function isChecksumValid(data, headerOffset) {
  const { checksum, complement } = readChecksumPair(data, headerOffset);
  if ((checksum ^ complement) !== 0xffff) {
    return false;
  }
  return computeChecksum(data, headerOffset) === checksum;
}
