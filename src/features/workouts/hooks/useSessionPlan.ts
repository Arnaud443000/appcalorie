import { useCallback, useEffect, useState } from 'react';
import { routineRepo, setEntryRepo } from '@/data';
import { loadPlan, savePlan } from '../data/planStorage';
import { planFromRoutine, planFromSets, type Plan } from '../logic';

/**
 * Plan de la séance (exercices prévus, ajoutés, remplacés, sautés).
 * Si le plan n'est plus sur l'appareil, on le reconstruit depuis le programme d'origine,
 * puis depuis les séries déjà enregistrées.
 */
export function useSessionPlan(sessionId: string, routineId: string | null) {
  const [plan, setPlan] = useState<Plan | null>(() => loadPlan(sessionId));

  useEffect(() => {
    if (plan !== null) return;
    let active = true;
    (async () => {
      const routine = routineId ? await routineRepo.get(routineId) : undefined;
      const rebuilt = routine
        ? planFromRoutine(routine.items)
        : planFromSets(await setEntryRepo.findBy('sessionId', sessionId));
      savePlan(sessionId, rebuilt);
      if (active) setPlan(rebuilt);
    })().catch(() => {
      if (active) setPlan([]);
    });
    return () => {
      active = false;
    };
  }, [plan, routineId, sessionId]);

  const update = useCallback(
    (change: (current: Plan) => Plan) => {
      setPlan((current) => {
        const next = change(current ?? []);
        savePlan(sessionId, next);
        return next;
      });
    },
    [sessionId],
  );

  return { plan, update };
}
