/**
 * Données de démonstration : 5 exercices complets.
 * Leurs id sont fixes, pour que les autres lots puissent s'y référer dans leurs tests.
 * Les 120 vrais exercices seront fournis par le lot « fiches ».
 */
import { db } from './db';
import { exerciseSchema, type Exercise, type NewRecord } from './schemas';

type DemoExercise = NewRecord<Exercise> & { id: string };

export const DEMO_EXERCISES: DemoExercise[] = [
  {
    id: '0d1e1a00-0000-4000-8000-000000000001',
    name: 'Développé couché',
    aliases: ['Bench press', 'DC'],
    equipment: ['barbell'],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    movementPattern: 'horizontal_push',
    level: 'intermediate',
    inputType: 'weight_reps',
    steps: [
      'Allonge-toi sur le banc, yeux sous la barre, pieds bien ancrés au sol.',
      'Serre les omoplates et garde une légère cambrure, fesses sur le banc.',
      'Saisis la barre un peu plus large que les épaules, poignets droits.',
      'Descends la barre contrôlée jusqu’au bas des pectoraux, coudes à environ 45°.',
      'Pousse la barre vers le haut et légèrement vers l’arrière jusqu’à bras tendus.',
    ],
    mistakes: [
      'Faire rebondir la barre sur la poitrine.',
      'Écarter les coudes à 90° du buste.',
      'Décoller les fesses du banc.',
      'Relâcher les omoplates en fin de série.',
    ],
    variations: ['Développé couché haltères', 'Développé incliné', 'Pompes'],
    loadAdvice:
      'Choisis une charge qui permet 6 à 10 répétitions propres en gardant 1 à 2 répétitions en réserve.',
    safety:
      'Utilise des sécurités ou un partenaire dès que la charge est lourde. Ne verrouille pas les pouces à l’extérieur de la barre.',
  },
  {
    id: '0d1e1a00-0000-4000-8000-000000000002',
    name: 'Tractions',
    aliases: ['Pull-up', 'Traction pronation'],
    equipment: ['bodyweight'],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'forearms', 'traps'],
    movementPattern: 'vertical_pull',
    level: 'intermediate',
    inputType: 'bodyweight_load',
    steps: [
      'Suspends-toi à la barre, mains en pronation un peu plus larges que les épaules.',
      'Engage les épaules en les abaissant, gainage serré.',
      'Tire les coudes vers les hanches jusqu’à passer le menton au-dessus de la barre.',
      'Redescends lentement jusqu’à bras presque tendus.',
    ],
    mistakes: [
      'Se balancer ou donner des coups de jambes.',
      'Faire des demi-répétitions sans redescendre.',
      'Hausser les épaules vers les oreilles.',
    ],
    variations: ['Tractions supination', 'Tractions avec élastique', 'Tirage vertical à la poulie'],
    loadAdvice:
      'Si tu fais plus de 12 répétitions, ajoute du lest (ceinture ou haltère entre les pieds).',
    safety: 'Évite de lâcher brusquement en bas. Arrête en cas de douleur au coude ou à l’épaule.',
  },
  {
    id: '0d1e1a00-0000-4000-8000-000000000003',
    name: 'Squat',
    aliases: ['Back squat', 'Squat barre'],
    equipment: ['barbell'],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['adductors', 'hamstrings', 'lower_back'],
    movementPattern: 'squat',
    level: 'intermediate',
    inputType: 'weight_reps',
    steps: [
      'Place la barre sur les trapèzes, mains serrées, coudes sous la barre.',
      'Pieds largeur d’épaules, pointes légèrement ouvertes.',
      'Inspire, gaine le ventre, puis descends en poussant les genoux dans l’axe des pieds.',
      'Descends au moins jusqu’à ce que les cuisses soient parallèles au sol.',
      'Remonte en poussant dans tout le pied, dos neutre.',
    ],
    mistakes: [
      'Genoux qui rentrent vers l’intérieur.',
      'Talons qui décollent.',
      'Dos qui s’arrondit en bas du mouvement.',
      'Remonter les fesses avant les épaules.',
    ],
    variations: ['Squat avant', 'Goblet squat', 'Presse à cuisses'],
    loadAdvice:
      'Commence par 3 séries de 5 à 8 répétitions et augmente de 2,5 kg quand tout est propre.',
    safety:
      'Travaille dans une cage avec les barres de sécurité réglées juste sous ta position basse.',
  },
  {
    id: '0d1e1a00-0000-4000-8000-000000000004',
    name: 'Curl haltères',
    aliases: ['Curl biceps', 'Dumbbell curl'],
    equipment: ['dumbbell'],
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    movementPattern: 'elbow_flexion',
    level: 'beginner',
    inputType: 'weight_reps',
    steps: [
      'Debout, un haltère dans chaque main, bras le long du corps, paumes vers l’avant.',
      'Garde les coudes collés au buste.',
      'Fléchis les coudes pour monter les haltères vers les épaules.',
      'Redescends lentement jusqu’à bras tendus.',
    ],
    mistakes: [
      'Balancer le buste pour monter la charge.',
      'Avancer les coudes en haut du mouvement.',
      'Redescendre trop vite.',
    ],
    variations: ['Curl marteau', 'Curl incliné', 'Curl à la barre'],
    loadAdvice: 'Vise 8 à 15 répétitions contrôlées ; si tu dois tricher, baisse la charge.',
    safety: 'Garde les poignets neutres. Arrête en cas de douleur à l’avant du coude.',
  },
  {
    id: '0d1e1a00-0000-4000-8000-000000000005',
    name: 'Gainage',
    aliases: ['Planche', 'Plank'],
    equipment: ['bodyweight'],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['shoulders', 'glutes', 'lower_back'],
    movementPattern: 'core',
    level: 'beginner',
    inputType: 'duration',
    steps: [
      'En appui sur les avant-bras, coudes sous les épaules.',
      'Tends les jambes, appui sur la pointe des pieds.',
      'Aligne tête, dos et bassin ; serre fessiers et abdos.',
      'Respire calmement et tiens la position.',
    ],
    mistakes: [
      'Laisser le bassin s’affaisser.',
      'Monter les fesses trop haut.',
      'Bloquer sa respiration.',
    ],
    variations: ['Gainage latéral', 'Gainage sur les mains', 'Planche avec levée de jambe'],
    loadAdvice:
      'Commence par 3 × 20 à 30 secondes. Au-delà de 60 secondes, passe à une variante plus difficile.',
    safety:
      'Arrête si tu sens une gêne dans le bas du dos : c’est le signe que le bassin s’affaisse.',
  },
];

/** Ajoute les exercices de démonstration absents (sans toucher à ceux déjà en base). */
export async function seedDemoData(): Promise<void> {
  await db.transaction('rw', db.exercises, async () => {
    const existing = await db.exercises.bulkGet(DEMO_EXERCISES.map((e) => e.id));
    const timestamp = new Date().toISOString();
    const missing = DEMO_EXERCISES.filter((_, i) => !existing[i]).map((exercise) =>
      exerciseSchema.parse({
        ...exercise,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      }),
    );
    if (missing.length > 0) await db.exercises.bulkAdd(missing);
  });
}
