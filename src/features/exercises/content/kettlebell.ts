import { sheet, type ExerciseSheet } from './types';

/** Kettlebell (6 fiches). */
export const KETTLEBELL_SHEETS: ExerciseSheet[] = [
  sheet(99, {
    name: 'Swing',
    aliases: ['Kettlebell swing', 'Balancier kettlebell'],
    equipment: ['kettlebell'],
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['lower_back', 'abs', 'shoulders'],
    movementPattern: 'hip_hinge',
    level: 'intermediate',
    inputType: 'weight_reps',
    steps: [
      'Pieds un peu plus larges que les épaules, kettlebell devant toi au sol.',
      'Penche le buste en poussant les hanches vers l’arrière, dos plat, et saisis la poignée.',
      'Balance la kettlebell entre les jambes, puis pousse les hanches vers l’avant.',
      'Laisse la kettlebell monter à hauteur de poitrine, bras tendus, sans la tirer.',
      'Laisse-la retomber en repoussant les hanches vers l’arrière.',
    ],
    mistakes: [
      'Faire un squat au lieu d’une charnière → pousse les hanches vers l’arrière, genoux à peine fléchis.',
      'Lever la kettlebell avec les bras → c’est l’élan des hanches qui la fait monter.',
      'Arrondir le dos → garde le dos plat et la poitrine sortie.',
    ],
    variations: [
      'Plus facile : Pont fessier',
      'Plus difficile : Swing à une main',
      'Autre matériel : Swing avec un haltère',
    ],
    loadAdvice: '4-6 séries de 10-20 répétitions, repos 60-90 s.',
    safety:
      'Apprends le mouvement avec une charge légère et garde le dos plat à chaque répétition.',
  }),
  sheet(100, {
    name: 'Turkish get-up',
    aliases: ['TGU', 'Relevé turc'],
    equipment: ['kettlebell'],
    primaryMuscles: ['shoulders', 'abs'],
    secondaryMuscles: ['glutes', 'quads', 'lats', 'traps'],
    movementPattern: 'core',
    level: 'advanced',
    inputType: 'weight_reps',
    steps: [
      'Allonge-toi sur le dos, kettlebell tenue bras tendu à la verticale, genou du même côté plié.',
      'Garde les yeux sur la kettlebell et redresse-toi sur le coude opposé.',
      'Monte sur la main, soulève le bassin, puis passe la jambe tendue derrière toi.',
      'Mets-toi à genoux, puis debout, bras toujours tendu vers le plafond.',
      'Reviens au sol en inversant les étapes, une par une.',
    ],
    mistakes: [
      'Aller trop vite → prends le temps de marquer chaque étape.',
      'Perdre la kettlebell des yeux → garde le regard dessus.',
      'Plier le bras sous la charge → garde le bras vertical et verrouillé.',
    ],
    variations: [
      'Plus facile : Turkish get-up sans poids',
      'Plus difficile : Turkish get-up avec une charge plus lourde',
      'Autre matériel : Turkish get-up avec un haltère',
    ],
    loadAdvice: '3-5 séries de 2-5 répétitions par côté, repos 60-90 s.',
    safety:
      'Apprends chaque étape sans charge, puis avec une charge légère, et dégage bien l’espace autour de toi.',
  }),
];
