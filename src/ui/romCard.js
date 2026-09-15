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
  card.appendChild(banner);

  const titleSpan = document.createElement("span");
  titleSpan.className = "rom-card__title";
  titleSpan.textContent = rom.title || rom.filename;
  banner.appendChild(titleSpan);

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

  return { element: card, banner, titleSpan, removeButton };
}

/**
 * Substitui o banner colorido pela capa real do jogo.
 * Só esconde o texto do título — nunca mexe nos filhos do banner (como o
 * botão de remover) via innerHTML/textContent, pra não apagá-los sem querer.
 * Define cada sub-propriedade do background individualmente (nunca o
 * shorthand `background`), pra não resetar o `background-size`/`position`
 * herdados da classe CSS e deixar a capa cortada/posicionada errado.
 */
export function setCardBoxart(cardHandle, imageUrl) {
  const { banner, titleSpan } = cardHandle;
  titleSpan.style.display = "none";
  banner.style.backgroundImage = `url("${imageUrl}")`;
  banner.style.backgroundSize = "cover";
  banner.style.backgroundPosition = "center";
  banner.style.backgroundRepeat = "no-repeat";
}
