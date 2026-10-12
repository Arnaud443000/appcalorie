import { useCallback, useEffect, useRef, useState } from 'react';
import { routineRepo, workoutSessionRepo } from '@/data';
import { planFromRoutine, type Plan } from '../logic';

/**
 * Plan de la séance (exercices prévus, ajoutés, remplacés, sautés), enregistré dans la séance
 * elle-même (`WorkoutSession.plan`). L'écran garde sa propre copie pour réagir tout de suite,
 * et chaque modification est écrite en base.
 * Une séance de programme dont le plan est vide (séance créée avant la version 2 sans plan
 * retrouvé) est reconstruite depuis le programme d'origine.
 */
export function useSessionPlan(sessionId: string, routineId: string | null, stored: Plan) {
  const [plan, setPlan] = useState<Plan | null>(() =>
    stored.length > 0 || routineId === null ? stored : null,
  );
  const current = useRef(plan);

  useEffect(() => {
    if (plan !== null) return;
    let active = true;
    (async () => {
      const routine = routineId ? await routineRepo.get(routineId) : undefined;
      const rebuilt = routine ? planFromRoutine(routine.items) : [];
      await workoutSessionRepo.update(sessionId, { plan: rebuilt });
      return rebuilt;
    })()
      .catch((): Plan => [])
      .then((rebuilt) => {
        if (!active) return;
        current.current = rebuilt;
        setPlan(rebuilt);
      });
    return () => {
      active = false;
    };
  }, [plan, routineId, sessionId]);

  const update = useCallback(
    (change: (current: Plan) => Plan) => {
      const next = change(current.current ?? []);
      current.current = next;
      setPlan(next);
      workoutSessionRepo.update(sessionId, { plan: next }).catch((error: unknown) => {
        console.error('Plan de séance non enregistré', error);
      });
    },
    [sessionId],
  );

  return { plan, update };
}
