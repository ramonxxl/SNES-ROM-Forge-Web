/**
 * Regras de validação aplicadas antes de gerar a imagem final.
 * Port direto de core/validator.py.
 */

export class ValidationError extends Error {}

/**
 * Valida a lista de ROMs contra as regras de bloqueio/aviso.
 *
 * `slotSizes` vem do cálculo de slots, um tamanho por ROM (mesma ordem de
 * `roms`): cada ROM deve caber sozinha dentro do seu slot, e é a SOMA dos
 * slots que precisa caber na flash — os slots podem ter tamanhos diferentes
 * entre si (quando uma ROM precisa expandir pra evitar posição vazia).
 *
 * Lança ValidationError na primeira regra de bloqueio violada. Retorna a
 * lista de avisos (não bloqueantes) quando tudo está OK.
 *
 * @param {import("./rom.js").SNESRom[]} roms
 * @param {{name: string, capacityBytes: number}} flashProfile
 * @param {number[]} slotSizes
 * @returns {{level: "warning"|"error", message: string}[]}
 */
export function validate(roms, flashProfile, slotSizes) {
  if (roms.length === 0) {
    throw new ValidationError("Nenhuma ROM selecionada para o merge.");
  }

  const messages = [];

  const mappings = new Set(roms.map((rom) => rom.mapping));
  if (mappings.has("unknown")) {
    const bad = roms.find((rom) => rom.mapping === "unknown");
    throw new ValidationError(
      `'${bad.filename}': mapeamento não pôde ser determinado (ROM corrompida ou sem vetor válido).`
    );
  }

  if (mappings.size > 1) {
    throw new ValidationError(
      `Mapeamento misto entre as ROMs selecionadas (${[...mappings].sort().join(", ")}); ` +
        "todas devem ser LoROM ou todas HiROM."
    );
  }

  const oversized = roms.filter((rom, i) => rom.romSizeBytes > slotSizes[i]).map((rom) => rom.filename);
  if (oversized.length > 0) {
    throw new ValidationError(`ROM(s) maior(es) que o slot calculado para elas na placa: ${oversized.join(", ")}.`);
  }

  const totalSlotsSize = slotSizes.reduce((a, b) => a + b, 0);
  if (totalSlotsSize > flashProfile.capacityBytes) {
    throw new ValidationError(
      `Os slots das ROMs somam ${totalSlotsSize} bytes, o que excede a capacidade da flash ` +
        `'${flashProfile.name}' (${flashProfile.capacityBytes} bytes).`
    );
  }

  for (const rom of roms) {
    if (rom.hasSmcHeader) {
      messages.push({ level: "warning", message: `'${rom.filename}': header SMC de 512 bytes removido.` });
    }
    if (!rom.checksumValid) {
      messages.push({ level: "warning", message: `'${rom.filename}': checksum original inválido, será corrigido.` });
    }
    const title = rom.title || "";
    const printable = [...title].every((c) => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) < 0x7f);
    if (!title || !printable) {
      messages.push({ level: "warning", message: `'${rom.filename}': título interno contém caracteres inválidos.` });
    }
  }

  return messages;
}
