/**
 * Programme personnel : 5 séances enregistrées comme programmes (routines) au démarrage.
 * Même principe que les exercices de démonstration : identifiants fixes, un programme absent
 * est créé, un programme existant n'est jamais modifié, un programme supprimé n'est pas recréé.
 * Les exercices sont retrouvés par leur nom (puis leurs autres noms) dans les fiches en base.
 */
import { db } from './db';
import { routineSchema, type Exercise, type RoutineItem } from './schemas';

interface ProgramLine {
  /** Nom de la fiche d'exercice. */
  exercise: string;
  sets: number;
  /** Objectif de répétitions (« 6-8 ») ou de durée (« 45-60 s »). */
  reps: string;
  /** Repos en secondes. */
  rest: number;
}

interface ProgramDay {
  id: string;
  name: string;
  lines: ProgramLine[];
}

const line = (exercise: string, sets: number, reps: string, rest: number): ProgramLine => ({
  exercise,
  sets,
  reps,
  rest,
});

/** Identifiant fixe d'un programme : `0d1e1a00-0000-4000-9000-` + numéro sur 12 chiffres. */
const programId = (n: number) => `0d1e1a00-0000-4000-9000-${String(n).padStart(12, '0')}`;

export const MY_PROGRAM: ProgramDay[] = [
  {
    id: programId(1),
    name: 'Lundi Push',
    lines: [
      line('Développé couché barre', 4, '6-8', 150),
      line('Développé incliné haltères', 4, '8-10', 120),
      line('Développé militaire haltères assis', 4, '8-10', 120),
      line('Écarté à la poulie vis-à-vis', 4, '12-15', 75),
      line('Élévations latérales haltères', 4, '12-15', 60),
      line('Extension poulie haute corde', 4, '10-12', 75),
      line('Barre au front', 3, '10-12', 90),
    ],
  },
  {
    id: programId(2),
    name: 'Mardi Pull',
    lines: [
      line('Tractions pronation', 4, '6-10', 150),
      line('Rowing barre', 4, '8-10', 150),
      line('Tirage vertical prise serrée', 4, '10-12', 105),
      line('Rowing poulie basse', 3, '10-12', 105),
      line('Face pull', 4, '15-20', 60),
      line('Curl barre EZ', 4, '8-10', 90),
      line('Curl marteau', 3, '10-12', 75),
    ],
  },
  {
    id: programId(3),
    name: 'Mercredi Jambes',
    lines: [
      line('Squat barre', 4, '6-8', 180),
      line('Presse à cuisses', 4, '10-12', 120),
      line('Fente bulgare', 3, '8-10', 90),
      line('Leg extension', 4, '12-15', 75),
      line('Leg curl couché', 4, '10-12', 90),
      line('Mollets debout machine', 5, '10-15', 60),
      line('Crunch à la poulie', 4, '12-15', 60),
    ],
  },
  {
    id: programId(4),
    name: 'Jeudi Haut du corps',
    lines: [
      line('Développé incliné haltères', 4, '10-12', 105),
      line('Tractions pronation', 4, '8-10', 120),
      line('Développé militaire haltères assis', 4, '10-12', 105),
      line('Rowing haltère un bras', 4, '10-12', 90),
      line('Élévations latérales haltères', 4, '15-20', 60),
      line('Oiseau haltères', 3, '15-20', 60),
      line('Barre au front', 3, '10-12', 90),
      line('Curl marteau', 3, '10-12', 75),
    ],
  },
  {
    id: programId(5),
    name: 'Vendredi Bas du corps',
    lines: [
      line('Soulevé de terre roumain', 4, '6-8', 150),
      line('Hip thrust barre', 4, '8-10', 120),
      line('Fente bulgare', 3, '8-10', 90),
      line('Presse à cuisses', 3, '12-15', 105),
      line('Leg curl couché', 3, '12-15', 75),
      line('Mollets debout machine', 4, '12-15', 60),
      line('Crunch à la poulie', 3, '15-20', 60),
      line('Gainage planche', 3, '45-60 s', 60),
    ],
  },
];

/** Texte comparable : sans accents, minuscules, espaces et tirets simplifiés. */
export function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Retrouve une fiche par son nom, sinon par un de ses autres noms (`aliases`). */
export function findExerciseByName(
  exercises: readonly Exercise[],
  name: string,
): Exercise | undefined {
  const wanted = normalizeName(name);
  return (
    exercises.find((e) => normalizeName(e.name) === wanted) ??
    exercises.find((e) => e.aliases.some((alias) => normalizeName(alias) === wanted))
  );
}

export interface SeedProgramResult {
  /** Programmes créés lors de cet appel. */
  created: string[];
  /** Exercices introuvables (le programme est créé sans eux). */
  missing: { routine: string; exercise: string }[];
}

/**
 * Crée les programmes de MY_PROGRAM qui n'existent pas encore (ni actifs, ni supprimés).
 * À lancer après le chargement des fiches. Un programme dont aucun exercice n'est trouvé
 * n'est pas créé (il le sera à un prochain démarrage, une fois les fiches présentes).
 */
export async function seedMyProgram(): Promise<SeedProgramResult> {
  const result: SeedProgramResult = { created: [], missing: [] };
  await db.transaction('rw', db.routines, db.exercises, async () => {
    const existing = await db.routines.bulkGet(MY_PROGRAM.map((day) => day.id));
    const toCreate = MY_PROGRAM.filter((_, i) => !existing[i]);
    if (toCreate.length === 0) return;

    const exercises = (await db.exercises.toArray()).filter((e) => e.deletedAt === null);
    const timestamp = new Date().toISOString();
    const routines = [];
    for (const day of toCreate) {
      const items: RoutineItem[] = [];
      for (const entry of day.lines) {
        const exercise = findExerciseByName(exercises, entry.exercise);
        if (!exercise) {
          result.missing.push({ routine: day.name, exercise: entry.exercise });
          continue;
        }
        items.push({
          exerciseId: exercise.id,
          targetSets: entry.sets,
          targetReps: entry.reps,
          restSeconds: entry.rest,
          note: '',
        });
      }
      if (items.length === 0) continue;
      routines.push(
        routineSchema.parse({
          id: day.id,
          name: day.name,
          note: '',
          items,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
        }),
      );
      result.created.push(day.name);
    }
    if (routines.length > 0) await db.routines.bulkAdd(routines);
  });
  for (const { routine, exercise } of result.missing) {
    console.warn(`Programme « ${routine} » : exercice introuvable « ${exercise} ».`);
  }
  return result;
}
