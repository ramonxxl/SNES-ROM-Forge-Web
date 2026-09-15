/**
 * Merge sequencial de ROMs SNES em uma única imagem para gravação em flash.
 * Port direto de core/merger.py + devices/board_profiles.py.
 *
 * Hardware confirmado (placa real do usuário): um PIC12F629 tem duas saídas
 * ligadas direto nas duas linhas de endereço mais altas da flash (A20/A21 na
 * 29L3211 de 4 MB). Como essas linhas só têm 4 combinações possíveis (2
 * bits), NENHUMA posição pode ficar sem jogo atribuído — um endereço
 * "flutuando" (flash em branco) faria o SNES travar se o PIC parasse ali.
 * Por isso, quando o número de ROMs não preenche as 4 posições sozinho, uma
 * das ROMs se repete inteira (cabeçalho e tudo) pra ocupar a posição extra.
 */

import { validate } from "./validator.js";

export const PADDING_BYTE = 0xff;
const DEFAULT_BASE_UNIT_BYTES = 1024 * 1024; // 1 MB — o que cada combinação de endereço cobre

/** Menor múltiplo (potência de 2) da unidade base que cabe a ROM sozinha. */
export function computeNaturalSlotSize(romSizeBytes, baseUnitBytes = DEFAULT_BASE_UNIT_BYTES) {
  let slotSize = baseUnitBytes;
  while (slotSize < romSizeBytes) {
    slotSize *= 2;
  }
  return slotSize;
}

/**
 * Calcula o slot de cada ROM, expandindo (dobrando) o(s) menor(es) até
 * ocupar EXATAMENTE toda a capacidade da flash — nunca deixando uma posição
 * de endereço sem jogo nenhum atribuído.
 *
 * Expande sempre o slot atualmente menor primeiro (e cada expansão dobra um
 * slot já existente, nunca cria um tamanho fora das potências de 2), o que
 * naturalmente evita ter que expandir um jogo que já ocupa mais de uma
 * posição por tamanho próprio.
 *
 * @param {import("./rom.js").SNESRom[]} roms
 * @param {number} flashCapacityBytes
 * @param {number} baseUnitBytes
 * @returns {number[]}
 */
export function resolveSlotSizes(roms, flashCapacityBytes, baseUnitBytes = DEFAULT_BASE_UNIT_BYTES) {
  if (roms.length === 0) return [];

  const sizes = roms.map((rom) => computeNaturalSlotSize(rom.romSizeBytes, baseUnitBytes));
  let total = sizes.reduce((a, b) => a + b, 0);

  while (total < flashCapacityBytes) {
    let minIndex = 0;
    for (let i = 1; i < sizes.length; i++) {
      if (sizes[i] < sizes[minIndex]) minIndex = i;
    }
    const added = sizes[minIndex];
    if (total + added > flashCapacityBytes) break; // validate() reporta o excesso
    sizes[minIndex] *= 2;
    total += added;
  }

  return sizes;
}

/**
 * Corrige o checksum de cada ROM (na ordem informada) e concatena.
 *
 * Cada ROM mantém seu próprio checksum interno corrigido — é o que o SNES lê
 * quando aquele slot está ativo; não existe (nem faz sentido gerar) um
 * checksum "global" sobre a imagem final. Quando o slot de uma ROM é maior
 * que o necessário pra caber ela sozinha (porque sobrou posição de endereço
 * sem jogo atribuído), a ROM inteira se repete pra preencher esse slot —
 * nunca deixando uma posição em branco ("flutuando"). O restante da
 * capacidade da flash é preenchido com 0xFF no final (nunca 0x00).
 *
 * @param {import("./rom.js").SNESRom[]} roms
 * @param {{name: string, capacityBytes: number}} flashProfile
 * @returns {{ data: Uint8Array, report: object }}
 */
export function merge(roms, flashProfile) {
  const slotSizes = resolveSlotSizes(roms, flashProfile.capacityBytes);
  const messages = validate(roms, flashProfile, slotSizes);

  const chunks = [];
  const romOffsets = [];
  let cursor = 0;

  roms.forEach((rom, index) => {
    const offset = cursor;
    const fixed = rom.fixedData();
    romOffsets.push([rom.filename, offset, fixed.length]);

    const naturalSize = computeNaturalSlotSize(rom.romSizeBytes);
    const naturalBlock = new Uint8Array(naturalSize);
    naturalBlock.set(fixed, 0);
    naturalBlock.fill(PADDING_BYTE, fixed.length);

    const slotSize = slotSizes[index];
    const repeatCount = slotSize / naturalSize;
    for (let r = 0; r < repeatCount; r++) {
      chunks.push(naturalBlock);
      cursor += naturalSize;
    }
  });

  const totalRomsSize = cursor;
  const paddingSize = flashProfile.capacityBytes - totalRomsSize;

  const output = new Uint8Array(totalRomsSize + paddingSize);
  let writeOffset = 0;
  for (const chunk of chunks) {
    output.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }
  if (paddingSize > 0) {
    output.fill(PADDING_BYTE, totalRomsSize);
  }

  const report = {
    messages,
    romOffsets,
    slotSizes,
    totalRomsSize,
    paddingSize,
    outputSize: output.length,
  };

  return { data: output, report };
}
