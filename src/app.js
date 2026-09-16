/**
 * Estado e orquestração da página — equivalente a gui/main_window.py.
 */

import { SNESRom } from "./core/rom.js";
import { merge, resolveSlotSizes } from "./core/merger.js";
import { ValidationError } from "./core/validator.js";
import { DEFAULT_FLASH_PROFILE, FLASH_PROFILES } from "./devices/flashProfiles.js";
import { createRomCard, setCardBoxart } from "./ui/romCard.js";
import { createDropZone } from "./ui/dropZone.js";
import { buildCandidateFilenames, fetchBoxart } from "./ui/boxart.js";

function formatSize(sizeBytes) {
  return `${sizeBytes} bytes (${(sizeBytes / 1024).toFixed(0)} KB)`;
}

function formatMB(sizeBytes) {
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

const DOWNLOAD_ICON_SVG = `
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M4 19h16" />
  </svg>
`;

const TRASH_ICON_SVG = `
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
`;

export class App {
  constructor(root) {
    this.root = root;
    this.roms = [];
    this.flashProfile = DEFAULT_FLASH_PROFILE;
    this._dragIndex = null;

    this._buildLayout();
  }

  _buildLayout() {
    this.root.innerHTML = "";

    const app = document.createElement("div");
    app.id = "app";

    app.appendChild(this._buildTopbar());

    const main = document.createElement("div");
    main.className = "main";

    const leftColumn = document.createElement("div");
    leftColumn.className = "left-column";

    const sectionTitle = document.createElement("h2");
    sectionTitle.className = "section-title";
    sectionTitle.textContent = "ROMs selecionadas";
    leftColumn.appendChild(sectionTitle);

    this.cardsScroll = document.createElement("div");
    this.cardsScroll.className = "cards-scroll";

    this.cardsRow = document.createElement("div");
    this.cardsRow.className = "cards-row";
    this.cardsScroll.appendChild(this.cardsRow);
    leftColumn.appendChild(this.cardsScroll);

    leftColumn.appendChild(this._buildOccupancyBar());

    this.logEl = document.createElement("div");
    this.logEl.className = "log";
    leftColumn.appendChild(this.logEl);

    main.appendChild(leftColumn);

    const sidebar = document.createElement("div");
    sidebar.className = "sidebar";

    const generateButton = document.createElement("button");
    generateButton.className = "icon-button orange";
    generateButton.title = "Gerar BIN";
    generateButton.innerHTML = DOWNLOAD_ICON_SVG;
    generateButton.addEventListener("click", () => this._onGenerateBin());
    sidebar.appendChild(generateButton);

    const clearButton = document.createElement("button");
    clearButton.className = "icon-button red";
    clearButton.title = "Limpar ROMs importadas";
    clearButton.innerHTML = TRASH_ICON_SVG;
    clearButton.addEventListener("click", () => this._onClearRoms());
    sidebar.appendChild(clearButton);

    const helpLink = document.createElement("a");
    helpLink.className = "icon-button gray";
    helpLink.title = "Ajuda / Como usar";
    helpLink.textContent = "?";
    helpLink.href = "docs.html";
    helpLink.target = "_blank";
    helpLink.rel = "noopener";
    sidebar.appendChild(helpLink);

    main.appendChild(sidebar);
    app.appendChild(main);

    this.root.appendChild(app);

    this._rebuildCards();
  }

  _buildTopbar() {
    const topbar = document.createElement("div");
    topbar.className = "topbar";

    const title = document.createElement("div");
    title.className = "topbar__title";
    title.textContent = "SNES ROM Forge";
    topbar.appendChild(title);

    const flashControl = document.createElement("div");
    flashControl.className = "topbar__flash";

    const flashLabel = document.createElement("label");
    flashLabel.className = "topbar__flash-label";
    flashLabel.textContent = "Capacidade da flash";
    flashLabel.htmlFor = "flash-profile-select";
    flashControl.appendChild(flashLabel);

    const flashSelect = document.createElement("select");
    flashSelect.id = "flash-profile-select";
    FLASH_PROFILES.forEach((profile, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = profile.name;
      if (profile.name === this.flashProfile.name) option.selected = true;
      flashSelect.appendChild(option);
    });
    flashSelect.addEventListener("change", () => {
      this.flashProfile = FLASH_PROFILES[Number(flashSelect.value)];
      this.log(`Flash selecionada: ${this.flashProfile.name}.`);
      this._updateOccupancy();
    });
    flashControl.appendChild(flashSelect);

    topbar.appendChild(flashControl);
    return topbar;
  }

  _buildOccupancyBar() {
    const occupancy = document.createElement("div");
    occupancy.className = "occupancy";

    const header = document.createElement("div");
    header.className = "occupancy__header";

    const label = document.createElement("span");
    label.textContent = "Ocupação da flash";
    header.appendChild(label);

    this.occupancyValueEl = document.createElement("span");
    this.occupancyValueEl.className = "occupancy__value";
    header.appendChild(this.occupancyValueEl);

    occupancy.appendChild(header);

    this.occupancyTrackEl = document.createElement("div");
    this.occupancyTrackEl.className = "occupancy__track";

    this.occupancyRomFillEl = document.createElement("div");
    this.occupancyRomFillEl.className = "occupancy__fill-rom";
    this.occupancyTrackEl.appendChild(this.occupancyRomFillEl);

    this.occupancyPaddingFillEl = document.createElement("div");
    this.occupancyPaddingFillEl.className = "occupancy__fill-padding";
    this.occupancyTrackEl.appendChild(this.occupancyPaddingFillEl);

    occupancy.appendChild(this.occupancyTrackEl);
    return occupancy;
  }

  /**
   * O quanto vai pra flash (slotBytes) é maior que a soma dos arquivos de ROM
   * (rawRomBytes): slots são arredondados pra potência de 2 e, quando sobra
   * posição de endereço na placa, uma ROM se repete pra preenchê-la (ver
   * resolveSlotSizes em merger.js). Mostra os dois valores separados pra não
   * parecer que a flash "encheu" só com os arquivos importados.
   */
  _updateOccupancy() {
    const capacity = this.flashProfile.capacityBytes;
    const rawRomBytes = this.roms.reduce((total, rom) => total + rom.romSizeBytes, 0);
    const slotBytes = resolveSlotSizes(this.roms, capacity).reduce((a, b) => a + b, 0);
    const paddingBytes = slotBytes - rawRomBytes;
    const over = slotBytes > capacity;

    const visibleRatio = capacity > 0 ? Math.min(slotBytes / capacity, 1) : 0;
    const romShare = slotBytes > 0 ? rawRomBytes / slotBytes : 0;
    const paddingShare = slotBytes > 0 ? paddingBytes / slotBytes : 0;

    this.occupancyRomFillEl.style.width = `${romShare * visibleRatio * 100}%`;
    this.occupancyPaddingFillEl.style.width = `${paddingShare * visibleRatio * 100}%`;
    this.occupancyTrackEl.classList.toggle("occupancy__track--over", over);

    const breakdown = `${formatMB(rawRomBytes)} de ROMs + ${formatMB(paddingBytes)} de alinhamento`;
    const total = over
      ? `${formatMB(slotBytes)} / ${formatMB(capacity)} (excede em ${formatMB(slotBytes - capacity)})`
      : `${formatMB(slotBytes)} / ${formatMB(capacity)} (${Math.round((slotBytes / capacity) * 100)}%)`;
    this.occupancyValueEl.textContent = `${breakdown} = ${total}`;
  }

  log(text) {
    this.logEl.textContent += `${text}\n`;
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  _rebuildCards() {
    this.cardsRow.innerHTML = "";

    this.roms.forEach((rom, index) => {
      const cardHandle = createRomCard(rom, () => this._onRemoveRom(index));
      const card = cardHandle.element;
      card.draggable = true;

      card.addEventListener("dragstart", (event) => {
        this._dragIndex = index;
        card.classList.add("rom-card--dragging");
        event.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("rom-card--dragging");
        this._dragIndex = null;
      });
      card.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      });
      card.addEventListener("drop", (event) => {
        event.preventDefault();
        if (this._dragIndex === null || this._dragIndex === index) return;
        this._onReorderRoms(this._dragIndex, index);
      });

      this.cardsRow.appendChild(card);
      this._fetchBoxartFor(rom, cardHandle);
    });

    const dropZone = createDropZone((files) => this._onFilesSelected(files));
    this.cardsRow.appendChild(dropZone);

    this._updateOccupancy();
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

  _onReorderRoms(fromIndex, toIndex) {
    const [rom] = this.roms.splice(fromIndex, 1);
    this.roms.splice(toIndex, 0, rom);
    this._rebuildCards();
  }

  _onClearRoms() {
    if (this.roms.length === 0) return;
    if (!window.confirm(`Remover as ${this.roms.length} ROM(s) importada(s)?`)) return;
    this.roms = [];
    this.log("Todas as ROMs foram removidas.");
    this._rebuildCards();
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
