import { estimateOneRepMax } from './oneRepMax';
import type { InputType, SetLike } from './types';
import { setVolume } from './volume';

export type RecordKind =
  'maxWeight' | 'maxReps' | 'maxVolume' | 'oneRepMax' | 'maxDuration' | 'maxDistance';

export const RECORD_LABELS: Record<RecordKind, string> = {
  maxWeight: 'Charge max',
  maxReps: 'Répétitions max',
  maxVolume: 'Volume max',
  oneRepMax: '1RM estimé',
  maxDuration: 'Durée max',
  maxDistance: 'Distance max',
};

/** Records qui ont un sens pour chaque type de saisie. */
export const RECORD_KINDS_BY_INPUT: Record<InputType, readonly RecordKind[]> = {
  weight_reps: ['maxWeight', 'maxReps', 'maxVolume', 'oneRepMax'],
  // Au poids du corps avec lest, la charge est le lest : pas de 1RM (on ignore le poids du corps).
  bodyweight_load: ['maxWeight', 'maxReps', 'maxVolume'],
  reps: ['maxReps'],
  duration: ['maxDuration'],
  distance: ['maxDistance'],
};

export interface RecordValue {
  kind: RecordKind;
  value: number;
  /** Séance où la valeur a été atteinte. */
  sessionId: string;
}

export type ExerciseRecords = Partial<Record<RecordKind, RecordValue>>;

export interface RecordBreak {
  kind: RecordKind;
  value: number;
  /** Ancien record battu. */
  previous: number;
}

const positive = (n: number | null | undefined): n is number =>
  n != null && Number.isFinite(n) && n > 0;

/** Valeurs candidates d'une série pour chaque record (aucune pour un échauffement). */
function candidates(set: SetLike, inputType: InputType): Partial<Record<RecordKind, number>> {
  if (set.isWarmup) return {};
  const out: Partial<Record<RecordKind, number>> = {};
  switch (inputType) {
    case 'weight_reps':
    case 'bodyweight_load':
      if (positive(set.reps)) {
        out.maxReps = set.reps;
        if (positive(set.weight)) out.maxWeight = set.weight;
        if (inputType === 'weight_reps') {
          const oneRm = estimateOneRepMax(set.weight, set.reps);
          if (oneRm !== null) out.oneRepMax = oneRm;
        }
      }
      break;
    case 'reps':
      if (positive(set.reps)) out.maxReps = set.reps;
      break;
    case 'duration':
      if (positive(set.durationSeconds)) out.maxDuration = set.durationSeconds;
      break;
    case 'distance':
      if (positive(set.distanceMeters)) out.maxDistance = set.distanceMeters;
      break;
  }
  return out;
}

/**
 * Meilleures valeurs de l'exercice sur tout l'historique donné.
 * Le « volume max » est le meilleur volume de l'exercice sur UNE séance.
 * Les échauffements sont ignorés. Un record absent n'apparaît pas dans le résultat.
 */
export function exerciseRecords(sets: readonly SetLike[], inputType: InputType): ExerciseRecords {
  const kinds = RECORD_KINDS_BY_INPUT[inputType];
  const result: ExerciseRecords = {};
  const volumeBySession = new Map<string, number>();

  for (const set of sets) {
    if (set.isWarmup) continue;
    const found = candidates(set, inputType);
    for (const kind of kinds) {
      const value = found[kind];
      if (value === undefined) continue;
      const current = result[kind];
      if (!current || value > current.value) {
        result[kind] = { kind, value, sessionId: set.sessionId };
      }
    }
    if (kinds.includes('maxVolume')) {
      const volume = positive(set.reps) ? setVolume(set) : 0;
      if (volume > 0) {
        volumeBySession.set(set.sessionId, (volumeBySession.get(set.sessionId) ?? 0) + volume);
      }
    }
  }

  for (const [sessionId, value] of volumeBySession) {
    const current = result.maxVolume;
    if (!current || value > current.value)
      result.maxVolume = { kind: 'maxVolume', value, sessionId };
  }
  return result;
}

/**
 * Records battus par `current` (les séries du jour) par rapport à `previous` (tout le reste).
 * Règles :
 * - il faut battre strictement un record existant : une égalité n'est pas un record ;
 * - la toute première fois qu'on fait un exercice, rien n'est annoncé (pas encore de record à battre) ;
 * - les échauffements ne comptent ni d'un côté ni de l'autre.
 */
export function detectRecords(
  previous: readonly SetLike[],
  current: readonly SetLike[],
  inputType: InputType,
): RecordBreak[] {
  const before = exerciseRecords(previous, inputType);
  const now = exerciseRecords(current, inputType);
  const breaks: RecordBreak[] = [];
  for (const kind of RECORD_KINDS_BY_INPUT[inputType]) {
    const old = before[kind];
    const fresh = now[kind];
    if (old && fresh && fresh.value > old.value) {
      breaks.push({ kind, value: fresh.value, previous: old.value });
    }
  }
  return breaks;
}
