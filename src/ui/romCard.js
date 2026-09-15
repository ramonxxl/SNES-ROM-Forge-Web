/**
 * Card visual de uma ROM importada (inspirado no site antigo do usuário).
 * Port direto de gui/rom_card.py — aqui monta um elemento DOM em vez de widgets Qt.
 */

const BANNER_PALETTE = ["--accent-blue", "--accent-purple", "--accent-green", "--accent-orange"];

const MAPPING_LABELS = { lorom: "LoROM", hirom: "HiROM", unknown: "?" };
const MAPPING_VARS = { lorom: "--accent-blue", hirom: "--accent-purple", unknown: "--accent-gray" };

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function bannerColorVar(title) {
  if (!title) return "--accent-gray";
  return BANNER_PALETTE[hashString(title) % BANNER_PALETTE.length];
}

function formatSize(sizeBytes) {
  const kb = sizeBytes / 1024;
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(2)} MB`;
}

function makeBadge(text, colorVar) {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.style.background = `var(${colorVar})`;
  badge.textContent = text;
  return badge;
}

/**
 * @param {import("../core/rom.js").SNESRom} rom
 * @param {() => void} onRemove
 * @returns {HTMLElement}
 */
export function createRomCard(rom, onRemove) {
  const card = document.createElement("div");
  card.className = "rom-card";

  const banner = document.createElement("div");
  banner.className = "rom-card__banner";
  banner.style.background = `var(${bannerColorVar(rom.title || rom.filename)})`;
  banner.textContent = rom.title || rom.filename;
  card.appendChild(banner);

  const removeButton = document.createElement("button");
  removeButton.className = "rom-card__remove";
  removeButton.type = "button";
  removeButton.textContent = "✕";
  removeButton.title = "Remover";
  removeButton.addEventListener("click", onRemove);
  banner.appendChild(removeButton);

  const info = document.createElement("div");
  info.className = "rom-card__info";

  const checksumOk = rom.checksumValid;
  const headerYes = rom.hasSmcHeader;

  const rows = [
    ["Mapping", MAPPING_LABELS[rom.mapping], MAPPING_VARS[rom.mapping]],
    ["Tamanho", formatSize(rom.romSizeBytes), "--accent-orange"],
    ["Header SMC", headerYes ? "Sim" : "Não", headerYes ? "--accent-orange" : "--accent-gray"],
    ["Checksum", checksumOk ? "Válido" : "Corrigido", checksumOk ? "--accent-green" : "--accent-orange"],
  ];

  for (const [label, value, colorVar] of rows) {
    const labelEl = document.createElement("span");
    labelEl.className = "rom-card__label";
    labelEl.textContent = label;
    info.appendChild(labelEl);
    info.appendChild(makeBadge(value, colorVar));
  }

  card.appendChild(info);

  return { element: card, banner };
}

/** Substitui o banner colorido pela capa real do jogo. */
export function setCardBoxart(cardHandle, imageUrl) {
  const { banner } = cardHandle;
  banner.textContent = "";
  banner.style.background = "none";
  banner.style.backgroundImage = `url("${imageUrl}")`;

  // o botão de remover precisa continuar visível por cima da capa
  const removeButton = banner.querySelector(".rom-card__remove");
  if (removeButton) banner.appendChild(removeButton);
}
