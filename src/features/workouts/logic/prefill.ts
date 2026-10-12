import { type LastPerformance, matchingLastSet, type SetLike } from '@/data';

type Values = Pick<SetLike, 'weight' | 'reps' | 'durationSeconds' | 'distanceMeters'>;

const same = (a: Values, b: Values) =>
  a.weight === b.weight &&
  a.reps === b.reps &&
  a.durationSeconds === b.durationSeconds &&
  a.distanceMeters === b.distanceMeters;

/**
 * Valeurs proposées pour la prochaine série d'un exercice.
 * - 1re série : celle de la dernière fois (même rang) ;
 * - ensuite : si tu as refait la même chose que la dernière fois, on continue avec la série
 *   suivante de la dernière fois ; sinon on reprend ta série précédente d'aujourd'hui
 *   (garder la même charge est le cas le plus courant).
 * `todaySets` : séries déjà faites aujourd'hui pour cet exercice, du même type (travail ou échauffement).
 */
export function prefillNextSet<S extends SetLike>(
  last: LastPerformance<S> | null,
  todaySets: readonly Values[],
  isWarmup: boolean,
): Values | null {
  const index = todaySets.length;
  const previousToday = todaySets[index - 1];
  const nextLast = matchingLastSet(last, isWarmup, index);
  if (!previousToday) return nextLast;
  const previousLast = matchingLastSet(last, isWarmup, index - 1);
  if (nextLast && previousLast && same(previousToday, previousLast)) return nextLast;
  return previousToday;
}
