import { normalizeText } from './text';
import type { FoodState } from './types';

// Mots (sans accents, au pluriel/féminin inclus) qui disent « cuit » ou « cru ».
const COOKED_WORDS = new Set([
  'cuit', 'cuite', 'cuits', 'cuites',
  'roti', 'rotie', 'rotis', 'roties',
  'grille', 'grillee', 'grilles', 'grillees',
  'poele', 'poelee', 'poeles', 'poelees',
  'bouilli', 'bouillie', 'bouillis', 'bouillies',
  'braise', 'braisee', 'braises', 'braisees',
  'saute', 'sautee', 'sautes', 'sautees',
  'vapeur', 'cooked', 'roasted', 'grilled', 'boiled',
]); // prettier-ignore
const RAW_WORDS = new Set(['cru', 'crue', 'crus', 'crues', 'raw']);

/**
 * Devine l'état d'un aliment d'après son nom et sa catégorie.
 * Renvoie `unknown` quand aucun indice n'existe OU quand les indices se contredisent
 * (« poulet cuit » rangé dans « viandes crues ») : en cas de doute, on ne tranche pas.
 */
export function detectFoodState(name: string, category = ''): FoodState {
  const words = normalizeText(`${name} ${category}`).split(' ');
  let raw = false;
  let cooked = false;

  words.forEach((word, i) => {
    const previous = words[i - 1];
    if (RAW_WORDS.has(word)) raw = true;
    else if (COOKED_WORDS.has(word)) {
      // « non cuit », « pas cuit » = cru.
      if (previous === 'non' || previous === 'pas') raw = true;
      else cooked = true;
    } else if (
      word === 'precuit' ||
      word === 'precuite' ||
      word === 'precuits' ||
      word === 'precuites'
    ) {
      cooked = true;
    } else if (word === 'cuire' && previous === 'a') {
      // « à cuire » = pas encore cuit.
      raw = true;
    }
  });

  if (raw === cooked) return 'unknown'; // rien trouvé, ou contradiction
  return raw ? 'raw' : 'cooked';
}
