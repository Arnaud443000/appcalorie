import { sheet, type ExerciseSheet } from './types';

/** Ischio-jambiers (6 fiches). */
export const HAMSTRINGS_SHEETS: ExerciseSheet[] = [
  sheet(80, {
    name: 'Soulevé de terre roumain',
    aliases: ['Romanian deadlift', 'RDL'],
    equipment: ['barbell'],
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back', 'forearms', 'traps'],
    movementPattern: 'hip_hinge',
    level: 'intermediate',
    inputType: 'weight_reps',
    steps: [
      'Debout, barre devant les cuisses, mains à largeur d’épaules, genoux légèrement fléchis.',
      'Serre les omoplates et garde le dos plat.',
      'Inspire et pousse les hanches vers l’arrière en faisant glisser la barre le long des cuisses.',
      'Descends jusqu’à sentir l’étirement des ischio-jambiers, dos toujours plat.',
      'Expire en poussant les hanches vers l’avant pour te redresser.',
    ],
    mistakes: [
      'Arrondir le dos → garde le dos plat et limite l’amplitude.',
      'Plier fortement les genoux → garde-les à peine fléchis.',
      'Éloigner la barre des jambes → garde-la collée tout le long.',
    ],
    variations: [
      'Plus facile : Soulevé de terre roumain avec haltères légers',
      'Plus difficile : Soulevé de terre roumain à une jambe',
      'Autre matériel : Pull-through à la poulie',
    ],
    loadAdvice: '3-4 séries de 6-10 répétitions, repos 2-3 min.',
    safety:
      'Garde le dos plat tout le long et arrête la descente dès que ton dos commence à s’arrondir.',
  }),
];
