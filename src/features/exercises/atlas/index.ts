/**
 * Lot « Atlas 3D » : corps anatomique en 3D. Le lot Fiches monte l'écran lui-même, par
 * exemple sous `/exercices/atlas` ; on peut y arriver avec `?muscle=<groupe>` ou
 * `?exercice=<id>` (voir atlasPath).
 */
export { AtlasScreen } from './AtlasScreen';
export { atlasPath, readAtlasParams, type AtlasParams } from './params';
