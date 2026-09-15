/**
 * Busca de capas de jogos (melhor esforço, sem chave de API) via libretro-thumbnails.
 * Port direto de gui/boxart.py — usa `fetch` + Cache Storage API do navegador
 * em vez de QNetworkAccessManager + cache em disco.
 *
 * Fonte: https://github.com/libretro-thumbnails (o mesmo acervo usado pelo
 * RetroArch), gratuito e sem cadastro. Tenta primeiro o nome do arquivo
 * importado e, se não achar, o título interno do cabeçalho. Quando nenhuma
 * tentativa encontra a capa (ou não há internet), quem chamou simplesmente
 * mantém o banner colorido — a busca nunca bloqueia o uso da página.
 */

const REPO_BASE =
  "https://raw.githubusercontent.com/libretro-thumbnails/" +
  "Nintendo_-_Super_Nintendo_Entertainment_System/master/Named_Boxarts/";
const REGIONS = ["USA", "World", "Europe", "Japan"];
const CACHE_NAME = "snes-rom-forge-boxart-v1";

function titleCase(str) {
  return str.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function filenameStem(filename) {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

/**
 * Nomes de arquivo candidatos no repositório, na ordem em que devem ser tentados.
 * @param {import("../core/rom.js").SNESRom} rom
 * @returns {string[]}
 */
export function buildCandidateFilenames(rom) {
  const names = [filenameStem(rom.filename)];

  const title = titleCase((rom.title || "").trim());
  if (title && !names.includes(title)) {
    names.push(title);
  }

  const candidates = [];
  for (const name of names) {
    for (const region of REGIONS) {
      candidates.push(`${name} (${region}).png`);
    }
  }
  return candidates;
}

async function openCache() {
  if (!("caches" in window)) return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

/**
 * Busca a capa de um jogo (melhor esforço), com cache via Cache Storage API.
 * @param {string} cacheKey chave estável (ex: o nome do arquivo da ROM)
 * @param {string[]} candidates lista de nomes de arquivo a tentar, em ordem
 * @returns {Promise<string|null>} um object URL da imagem, ou null se não achar
 */
export async function fetchBoxart(cacheKey, candidates) {
  const cache = await openCache();
  const cacheRequestUrl = `https://snes-rom-forge.cache/${encodeURIComponent(cacheKey)}`;

  if (cache) {
    const cached = await cache.match(cacheRequestUrl);
    if (cached) {
      const blob = await cached.blob();
      return URL.createObjectURL(blob);
    }
  }

  for (const filename of candidates) {
    const url = REPO_BASE + encodeURIComponent(filename);
    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const blob = await response.blob();
      if (cache) {
        await cache.put(cacheRequestUrl, new Response(blob, { headers: { "Content-Type": blob.type } }));
      }
      return URL.createObjectURL(blob);
    } catch {
      // sem internet, CORS bloqueado, etc. — tenta o próximo candidato
    }
  }

  return null;
}
