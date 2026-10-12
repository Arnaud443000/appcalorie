import { sheet, type ExerciseSheet } from './types';

/** Lombaires (3 fiches). */
export const LOWER_BACK_SHEETS: ExerciseSheet[] = [
  sheet(68, {
    name: 'Extension lombaires au banc 45°',
    imageSlug: 'extension-lombaires-au-banc-45',
    aliases: ['Hyperextension', 'Back extension', 'Chaise à lombaires'],
    equipment: ['bodyweight'],
    primaryMuscles: ['lower_back'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    movementPattern: 'hip_hinge',
    level: 'beginner',
    inputType: 'bodyweight_load',
    steps: [
      'Cale tes pieds, les hanches juste au bord du coussin.',
      'Croise les bras sur la poitrine, corps aligné de la tête aux pieds.',
      'Penche le buste vers le bas en gardant le dos plat.',
      'Expire en remontant jusqu’à aligner le corps, sans dépasser l’horizontale.',
    ],
    mistakes: [
      'Cambrer en haut → arrête-toi quand le corps est aligné.',
      'Arrondir le dos en bas → garde le dos plat tout le long.',
      'Monter avec un élan → contrôle la montée et la descente.',
    ],
    variations: [
      'Plus facile : Superman',
      'Plus difficile : Extension lombaires lestée avec un disque',
      'Autre matériel : Good morning',
    ],
    loadAdvice: '3 séries de 10-15 répétitions, repos 60-90 s.',
    safety: 'Ne cambre pas en haut et arrête si tu sens une douleur vive dans le bas du dos.',
  }),
  sheet(69, {
    name: 'Good morning',
    imageSlug: 'good-morning',
    aliases: ['Bonjour', 'Good morning barre'],
    equipment: ['barbell'],
    primaryMuscles: ['lower_back', 'hamstrings'],
    secondaryMuscles: ['glutes'],
    movementPattern: 'hip_hinge',
    level: 'advanced',
    inputType: 'weight_reps',
    steps: [
      'Place la barre sur les trapèzes, pieds largeur d’épaules, genoux légèrement fléchis.',
      'Serre les omoplates, dos plat, abdos gainés.',
      'Inspire et pousse les hanches vers l’arrière en penchant le buste.',
      'Descends jusqu’à l’horizontale environ, dos toujours plat.',
      'Expire en poussant les hanches vers l’avant pour te redresser.',
    ],
    mistakes: [
      'Arrondir le dos → garde le dos plat et réduis l’amplitude.',
      'Plier fortement les genoux → garde-les à peine fléchis.',
      'Prendre une charge trop lourde → commence très léger.',
    ],
    variations: [
      'Plus facile : Good morning sans barre, mains derrière la tête',
      'Plus difficile : Good morning avec pause en bas',
      'Autre matériel : Soulevé de terre roumain',
    ],
    loadAdvice: '3 séries de 8-12 répétitions, repos 90 s à 2 min.',
    safety:
      'Commence avec une barre très légère pour apprendre la charnière de hanche, et ne descends pas si ton dos s’arrondit.',
  }),
  sheet(70, {
    name: 'Superman',
    imageSlug: 'superman',
    aliases: ['Extension dorsale au sol', 'Superman au sol'],
    equipment: ['bodyweight'],
    primaryMuscles: ['lower_back'],
    secondaryMuscles: ['glutes', 'shoulders'],
    movementPattern: 'hip_hinge',
    level: 'beginner',
    inputType: 'reps',
    steps: [
      'Allonge-toi sur le ventre, bras tendus devant toi, jambes tendues.',
      'Regarde le sol pour garder la nuque dans l’axe.',
      'Expire en soulevant bras et jambes en même temps de quelques centimètres.',
      'Marque une pause d’une seconde, puis redescends lentement.',
    ],
    mistakes: [
      'Lever la tête vers l’avant → garde le regard vers le sol.',
      'Monter trop haut en cambrant → soulève seulement de quelques centimètres.',
      'Aller trop vite → ralentis et marque une pause en haut.',
    ],
    variations: [
      'Plus facile : Superman en soulevant un bras et la jambe opposée',
      'Plus difficile : Superman avec pause de 3 secondes',
      'Autre matériel : Extension lombaires au banc 45°',
    ],
    loadAdvice: '3 séries de 10-15 répétitions, repos 45-60 s.',
    safety: 'Soulève bras et jambes de quelques centimètres seulement, sans cambrer fortement.',
  }),
];
