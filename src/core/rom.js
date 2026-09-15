/**
 * Representa uma ROM SNES carregada e já analisada.
 * Port de core/rom.py — `SNESRom.load` recebe um `File` (ou objeto com
 * `.name` e `.arrayBuffer()`) em vez de um caminho de disco.
 */

import { fixChecksum, isChecksumValid, readChecksumPair } from "./checksum.js";
import { detect, stripSmcHeader } from "./detector.js";

export class SNESRom {
  constructor(fields) {
    Object.assign(this, fields);
  }

  /**
   * @param {File} file
   * @returns {Promise<SNESRom>}
   */
  static async load(file) {
    const rawBuffer = await file.arrayBuffer();
    const rawData = new Uint8Array(rawBuffer);
    const { data, hasSmcHeader } = stripSmcHeader(rawData);

    const { mapping, candidate, scores } = detect(data);

    if (!candidate) {
      return new SNESRom({
        filename: file.name,
        rawData,
        data,
        hasSmcHeader,
        mapping: "unknown",
        headerOffset: null,
        title: "",
        checksumValue: 0,
        complement: 0,
        checksumValid: false,
        romSizeBytes: data.length,
        detectionScores: scores,
      });
    }

    const { checksum, complement } = readChecksumPair(data, candidate.headerOffset);
    const valid = isChecksumValid(data, candidate.headerOffset);

    return new SNESRom({
      filename: file.name,
      rawData,
      data,
      hasSmcHeader,
      mapping,
      headerOffset: candidate.headerOffset,
      title: candidate.title,
      checksumValue: checksum,
      complement,
      checksumValid: valid,
      romSizeBytes: data.length,
      detectionScores: scores,
    });
  }

  /** Retorna os dados da ROM com o checksum interno corrigido. */
  fixedData() {
    if (this.headerOffset === null) {
      throw new Error(`'${this.filename}': mapeamento desconhecido, não é possível corrigir o checksum.`);
    }
    return fixChecksum(this.data, this.headerOffset);
  }
}
