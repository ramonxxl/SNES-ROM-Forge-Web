/**
 * Perfis de capacidade de memória flash suportados para gravação.
 * Port direto de devices/flash_profiles.py.
 */

export const FLASH_PROFILES = [
  { name: "29L3211 (4 MB / 32 Mbit)", capacityBytes: 4 * 1024 * 1024 },
  { name: "1 MB / 8 Mbit", capacityBytes: 1 * 1024 * 1024 },
  { name: "2 MB / 16 Mbit", capacityBytes: 2 * 1024 * 1024 },
  { name: "8 MB / 64 Mbit", capacityBytes: 8 * 1024 * 1024 },
];

export const DEFAULT_FLASH_PROFILE = FLASH_PROFILES[0];
