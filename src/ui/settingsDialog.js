/**
 * Diálogo de configurações (capacidade da flash), usando <dialog> nativo do HTML.
 * Port direto do SettingsDialog em gui/main_window.py.
 */

import { FLASH_PROFILES } from "../devices/flashProfiles.js";

/**
 * @param {{name: string, capacityBytes: number}} currentFlashProfile
 * @returns {Promise<{name: string, capacityBytes: number} | null>} null se cancelado
 */
export function openSettingsDialog(currentFlashProfile) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");

    const label = document.createElement("label");
    label.className = "section-label";
    label.textContent = "Capacidade da flash";
    dialog.appendChild(label);

    const select = document.createElement("select");
    FLASH_PROFILES.forEach((profile, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = profile.name;
      if (profile.name === currentFlashProfile.name) option.selected = true;
      select.appendChild(option);
    });
    dialog.appendChild(select);

    const buttons = document.createElement("div");
    buttons.className = "dialog-buttons";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancelar";

    const okButton = document.createElement("button");
    okButton.type = "button";
    okButton.className = "primary";
    okButton.textContent = "OK";

    buttons.appendChild(cancelButton);
    buttons.appendChild(okButton);
    dialog.appendChild(buttons);

    document.body.appendChild(dialog);

    const cleanup = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    cancelButton.addEventListener("click", () => cleanup(null));
    okButton.addEventListener("click", () => cleanup(FLASH_PROFILES[Number(select.value)]));
    dialog.addEventListener("cancel", () => cleanup(null));

    dialog.showModal();
  });
}
