import { parsePlan, type Plan } from '../logic';
import { readJson, removeStored, writeJson } from './storage';

const key = (sessionId: string) => `atlas.workouts.plan.${sessionId}`;

/**
 * Le plan d'une séance (exercices prévus, sautés, remplacés) n'a pas de champ dans la base :
 * il est gardé sur l'appareil, par séance. Voir DEMANDES.md.
 * Si le plan manque, on le reconstruit depuis le programme puis depuis les séries enregistrées.
 */
export function loadPlan(sessionId: string): Plan | null {
  return parsePlan(readJson(key(sessionId)));
}

export function savePlan(sessionId: string, plan: Plan): void {
  writeJson(key(sessionId), plan);
}

export function forgetPlan(sessionId: string): void {
  removeStored(key(sessionId));
}
