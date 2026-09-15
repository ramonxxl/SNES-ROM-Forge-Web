/**
 * Estado e orquestração da página — equivalente a gui/main_window.py.
 */

import { SNESRom } from "./core/rom.js";
import { merge } from "./core/merger.js";
import { ValidationError } from "./core/validator.js";
import { DEFAULT_FLASH_PROFILE } from "./devices/flashProfiles.js";
import { createRomCard, setCardBoxart } from "./ui/romCard.js";
import { createDropZone } from "./ui/dropZone.js";
import { openSettingsDialog } from "./ui/settingsDialog.js";
import { buildCandidateFilenames, fetchBoxart } from "./ui/boxart.js";

function formatSize(sizeBytes) {
  return `${sizeBytes} bytes (${(sizeBytes / 1024).toFixed(0)} KB)`;
}

export class App {
  constructor(root) {
    this.root = root;
    this.roms = [];
    this.flashProfile = DEFAULT_FLASH_PROFILE;

    this._buildLayout();
  }

  _buildLayout() {
    this.root.innerHTML = "";

    const app = document.createElement("div");
    app.id = "app";

    const leftColumn = document.createElement("div");
    leftColumn.className = "left-column";

    this.cardsScroll = document.createElement("div");
    this.cardsScroll.className = "cards-scroll";

    this.cardsRow = document.createElement("div");
    this.cardsRow.className = "cards-row";
    this.cardsScroll.appendChild(this.cardsRow);
    leftColumn.appendChild(this.cardsScroll);

    this.logEl = document.createElement("div");
    this.logEl.className = "log";
    leftColumn.appendChild(this.logEl);

    app.appendChild(leftColumn);

    const sidebar = document.createElement("div");
    sidebar.className = "sidebar";

    const settingsButton = document.createElement("button");
    settingsButton.className = "icon-button blue";
    settingsButton.title = "Configurações";
    settingsButton.textContent = "⚙";
    settingsButton.addEventListener("click", () => this._onOpenSettings());
    sidebar.appendChild(settingsButton);

    const generateButton = document.createElement("button");
    generateButton.className = "icon-button orange";
    generateButton.title = "Gerar BIN";
    generateButton.textContent = "↻";
    generateButton.addEventListener("click", () => this._onGenerateBin());
    sidebar.appendChild(generateButton);

    app.appendChild(sidebar);

    this.root.appendChild(app);

    this._rebuildCards();
  }

  log(text) {
    this.logEl.textContent += `${text}\n`;
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  _rebuildCards() {
    this.cardsRow.innerHTML = "";

    this.roms.forEach((rom, index) => {
      const cardHandle = createRomCard(rom, () => this._onRemoveRom(index));
      this.cardsRow.appendChild(cardHandle.element);
      this._fetchBoxartFor(rom, cardHandle);

      if (index < this.roms.length - 1) {
        const swapButton = document.createElement("button");
        swapButton.className = "swap-button";
        swapButton.type = "button";
        swapButton.textContent = "⇄";
        swapButton.addEventListener("click", () => this._onSwapRoms(index, index + 1));
        this.cardsRow.appendChild(swapButton);
      }
    });

    const dropZone = createDropZone((files) => this._onFilesSelected(files));
    this.cardsRow.appendChild(dropZone);
  }

  async _fetchBoxartFor(rom, cardHandle) {
    const candidates = buildCandidateFilenames(rom);
    const imageUrl = await fetchBoxart(rom.filename, candidates);
    if (imageUrl) setCardBoxart(cardHandle, imageUrl);
  }

  async _onFilesSelected(files) {
    for (const file of files) {
      try {
        const rom = await SNESRom.load(file);
        this.roms.push(rom);
        this.log(`Importada: '${rom.filename}' (${rom.mapping}, ${formatSize(rom.romSizeBytes)}).`);
      } catch (err) {
        this.log(`Erro ao ler '${file.name}': ${err.message}`);
      }
    }
    this._rebuildCards();
  }

  _onRemoveRom(index) {
    const [rom] = this.roms.splice(index, 1);
    this.log(`Removida: '${rom.filename}'.`);
    this._rebuildCards();
  }

  _onSwapRoms(i, j) {
    [this.roms[i], this.roms[j]] = [this.roms[j], this.roms[i]];
    this._rebuildCards();
  }

  async _onOpenSettings() {
    const chosen = await openSettingsDialog(this.flashProfile);
    if (chosen) {
      this.flashProfile = chosen;
      this.log(`Flash selecionada: ${chosen.name}.`);
    }
  }

  async _onGenerateBin() {
    let data;
    let report;
    try {
      ({ data, report } = merge(this.roms, this.flashProfile));
    } catch (err) {
      if (err instanceof ValidationError) {
        this.log(`ERRO: ${err.message}`);
        window.alert(`Não foi possível gerar o BIN:\n${err.message}`);
        return;
      }
      throw err;
    }

    for (const message of report.messages) {
      const prefix = message.level === "warning" ? "AVISO" : "ERRO";
      this.log(`${prefix}: ${message.message}`);
    }

    const saved = await this._saveBinFile(data);
    if (!saved) return;

    this.log(`Imagem gerada (${formatSize(report.outputSize)}).`);
    this.log("Resumo:");
    report.romOffsets.forEach(([filename, offset, size], index) => {
      const slotSize = report.slotSizes[index];
      const slotPadding = slotSize - size;
      this.log(
        `  - ${filename}: offset 0x${offset.toString(16).padStart(6, "0").toUpperCase()}, ${formatSize(size)} ` +
          `[slot de ${formatSize(slotSize)}, + ${formatSize(slotPadding)} de padding]`
      );
    });
    this.log(`  - Padding final (0xFF): ${formatSize(report.paddingSize)}`);
  }

  /** @returns {Promise<boolean>} true se o arquivo foi salvo (ou o download iniciado) */
  async _saveBinFile(data) {
    if (typeof window.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: "rom_forge.bin",
          types: [{ description: "Imagem BIN", accept: { "application/octet-stream": [".bin"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
        return true;
      } catch (err) {
        if (err.name === "AbortError") return false; // usuário cancelou
        this.log(`Erro ao salvar: ${err.message}`);
        return false;
      }
    }

    // Firefox/Safari: sem File System Access API, baixa via <a download>
    const blob = new Blob([data], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rom_forge.bin";
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  }
}
