export interface PikachuSpriteDef {
  id: string;
  dexNo: number;
  name: string;
  accent: string;
  dataUrl: string;
}

export interface PikachuSpritePack {
  id: string;
  name: string;
  description: string;
  sprites: PikachuSpriteDef[];
}

interface SpriteManifestEntry {
  id: string;
  dexNo: number;
  name: string;
  accent: string;
  src: string;
}

/**
 * Asset Manifest for Classic Onet Pikachu 2D Pixel-Art Sprites.
 * Every species has a deterministic, stable ID (pokemon_001 .. pokemon_036)
 * pointing directly to its pre-rendered transparent PNG sprite in /assets/pikachu/.
 * Swap or add custom PNG sprite packs here without changing any game logic.
 */
export const CLASSIC_SPRITE_MANIFEST: readonly SpriteManifestEntry[] = [
  { id: 'pokemon_001', dexNo: 25, name: 'Pikachu', accent: '#FACC15', src: '/assets/pikachu/pokemon_001.png' },
  { id: 'pokemon_002', dexNo: 1, name: 'Bulbasaur', accent: '#22C55E', src: '/assets/pikachu/pokemon_002.png' },
  { id: 'pokemon_003', dexNo: 4, name: 'Charmander', accent: '#F97316', src: '/assets/pikachu/pokemon_003.png' },
  { id: 'pokemon_004', dexNo: 8, name: 'Wartortle', accent: '#3B82F6', src: '/assets/pikachu/pokemon_004.png' },
  { id: 'pokemon_005', dexNo: 12, name: 'Butterfree', accent: '#6366F1', src: '/assets/pikachu/pokemon_005.png' },
  { id: 'pokemon_006', dexNo: 15, name: 'Beedrill', accent: '#EAB308', src: '/assets/pikachu/pokemon_006.png' },
  { id: 'pokemon_007', dexNo: 35, name: 'Clefairy', accent: '#F472B6', src: '/assets/pikachu/pokemon_007.png' },
  { id: 'pokemon_008', dexNo: 52, name: 'Meowth', accent: '#D97706', src: '/assets/pikachu/pokemon_008.png' },
  { id: 'pokemon_009', dexNo: 54, name: 'Psyduck', accent: '#EAB308', src: '/assets/pikachu/pokemon_009.png' },
  { id: 'pokemon_010', dexNo: 59, name: 'Arcanine', accent: '#EA580C', src: '/assets/pikachu/pokemon_010.png' },
  { id: 'pokemon_011', dexNo: 61, name: 'Poliwhirl', accent: '#2563EB', src: '/assets/pikachu/pokemon_011.png' },
  { id: 'pokemon_012', dexNo: 134, name: 'Vaporeon', accent: '#0EA5E9', src: '/assets/pikachu/pokemon_012.png' },
  { id: 'pokemon_013', dexNo: 136, name: 'Flareon', accent: '#F97316', src: '/assets/pikachu/pokemon_013.png' },
  { id: 'pokemon_014', dexNo: 151, name: 'Mew', accent: '#EC4899', src: '/assets/pikachu/pokemon_014.png' },
  { id: 'pokemon_015', dexNo: 158, name: 'Totodile', accent: '#2563EB', src: '/assets/pikachu/pokemon_015.png' },
  { id: 'pokemon_016', dexNo: 152, name: 'Chikorita', accent: '#10B981', src: '/assets/pikachu/pokemon_016.png' },
  { id: 'pokemon_017', dexNo: 183, name: 'Marill', accent: '#3B82F6', src: '/assets/pikachu/pokemon_017.png' },
  { id: 'pokemon_018', dexNo: 10, name: 'Caterpie', accent: '#22C55E', src: '/assets/pikachu/pokemon_018.png' },
  { id: 'pokemon_019', dexNo: 17, name: 'Pidgeotto', accent: '#D97706', src: '/assets/pikachu/pokemon_019.png' },
  { id: 'pokemon_020', dexNo: 30, name: 'Nidorina', accent: '#38BDF8', src: '/assets/pikachu/pokemon_020.png' },
  { id: 'pokemon_021', dexNo: 116, name: 'Horsea', accent: '#0EA5E9', src: '/assets/pikachu/pokemon_021.png' },
  { id: 'pokemon_022', dexNo: 78, name: 'Rapidash', accent: '#F97316', src: '/assets/pikachu/pokemon_022.png' },
  { id: 'pokemon_023', dexNo: 87, name: 'Dewgong', accent: '#94A3B8', src: '/assets/pikachu/pokemon_023.png' },
  { id: 'pokemon_024', dexNo: 138, name: 'Omanyte', accent: '#60A5FA', src: '/assets/pikachu/pokemon_024.png' },
  { id: 'pokemon_025', dexNo: 181, name: 'Ampharos', accent: '#FACC15', src: '/assets/pikachu/pokemon_025.png' },
  { id: 'pokemon_026', dexNo: 179, name: 'Mareep', accent: '#FDE047', src: '/assets/pikachu/pokemon_026.png' },
  { id: 'pokemon_027', dexNo: 186, name: 'Politoed', accent: '#22C55E', src: '/assets/pikachu/pokemon_027.png' },
  { id: 'pokemon_028', dexNo: 190, name: 'Aipom', accent: '#9333EA', src: '/assets/pikachu/pokemon_028.png' },
  { id: 'pokemon_029', dexNo: 177, name: 'Natu', accent: '#16A34A', src: '/assets/pikachu/pokemon_029.png' },
  { id: 'pokemon_030', dexNo: 165, name: 'Ledyba', accent: '#DC2626', src: '/assets/pikachu/pokemon_030.png' },
  { id: 'pokemon_031', dexNo: 225, name: 'Delibird', accent: '#EF4444', src: '/assets/pikachu/pokemon_031.png' },
  { id: 'pokemon_032', dexNo: 222, name: 'Corsola', accent: '#F472B6', src: '/assets/pikachu/pokemon_032.png' },
  { id: 'pokemon_033', dexNo: 207, name: 'Gligar', accent: '#A855F7', src: '/assets/pikachu/pokemon_033.png' },
  { id: 'pokemon_034', dexNo: 241, name: 'Miltank', accent: '#EC4899', src: '/assets/pikachu/pokemon_034.png' },
  { id: 'pokemon_035', dexNo: 175, name: 'Togepi', accent: '#F59E0B', src: '/assets/pikachu/pokemon_035.png' },
  { id: 'pokemon_036', dexNo: 176, name: 'Togetic', accent: '#E2E8F0', src: '/assets/pikachu/pokemon_036.png' },
];

const CLASSIC_PACK: PikachuSpritePack = {
  id: 'kanto-retro',
  name: 'Pikachu Cổ Điển (36 nhân vật)',
  description: 'Bộ sprite 2D pixel art nguyên bản với ID ổn định pokemon_001–pokemon_036.',
  sprites: CLASSIC_SPRITE_MANIFEST.map((entry) => ({
    id: entry.id,
    dexNo: entry.dexNo,
    name: entry.name,
    accent: entry.accent,
    dataUrl: entry.src,
  })),
};

export const SPRITE_PACKS: Record<string, PikachuSpritePack> = {
  'kanto-retro': CLASSIC_PACK,
  classic: CLASSIC_PACK,
};

export function getSpritePack(packId = 'kanto-retro'): PikachuSpritePack {
  return SPRITE_PACKS[packId] ?? CLASSIC_PACK;
}

export function getSpriteMap(packId = 'kanto-retro'): Record<string, PikachuSpriteDef> {
  const pack = getSpritePack(packId);
  const map: Record<string, PikachuSpriteDef> = {};
  for (const s of pack.sprites) {
    map[s.id] = s;
  }
  return map;
}
