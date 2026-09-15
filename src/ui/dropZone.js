/**
 * Área de arrastar-e-soltar (ou clicar) para importar novas ROMs.
 * Port direto de gui/drop_zone.py.
 */

const ROM_EXTENSIONS = [".sfc", ".smc", ".bin"];

/**
 * @param {(files: File[]) => void} onFilesSelected
 * @returns {HTMLElement}
 */
export function createDropZone(onFilesSelected) {
  const zone = document.createElement("div");
  zone.className = "drop-zone";

  const icon = document.createElement("div");
  icon.className = "drop-zone__icon";
  icon.textContent = "\u{1F3AE}";
  zone.appendChild(icon);

  const text = document.createElement("div");
  text.className = "drop-zone__text";
  text.textContent = "clique ou arraste a ROM para esta área";
  zone.appendChild(text);

  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = ROM_EXTENSIONS.join(",");
  input.hidden = true;
  zone.appendChild(input);

  zone.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    if (input.files.length > 0) onFilesSelected([...input.files]);
    input.value = "";
  });

  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("active");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("active"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("active");
    const files = [...event.dataTransfer.files].filter((file) =>
      ROM_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
    );
    if (files.length > 0) onFilesSelected(files);
  });

  return zone;
}
