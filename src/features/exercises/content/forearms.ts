import { sheet, type ExerciseSheet } from './types';

/** Avant-bras (3 fiches). */
export const FOREARMS_SHEETS: ExerciseSheet[] = [
  sheet(56, {
    name: 'Curl des poignets',
    aliases: ['Wrist curl', 'Flexion des poignets'],
    equipment: ['dumbbell'],
    primaryMuscles: ['forearms'],
    secondaryMuscles: [],
    movementPattern: 'elbow_flexion',
    level: 'beginner',
    inputType: 'weight_reps',
    steps: [
      'Assis, avant-bras posés sur les cuisses, paumes vers le haut, haltères en main.',
      'Laisse les poignets dépasser du genou, mains relâchées vers le bas.',
      'Expire en fléchissant les poignets pour monter les haltères.',
      'Redescends lentement jusqu’à ce que les doigts s’ouvrent à moitié.',
    ],
    mistakes: [
      'Soulever les avant-bras → garde-les posés sur les cuisses.',
      'Prendre une charge trop lourde → baisse la charge pour garder tout le trajet.',
      'Aller trop vite → prends 2 secondes à la montée et à la descente.',
    ],
    variations: [
      'Plus facile : Curl des poignets avec haltères légers',
      'Plus difficile : Curl des poignets avec pause en haut',
      'Autre matériel : Curl des poignets à la barre',
    ],
    loadAdvice: '3 séries de 12-20 répétitions, repos 60 s.',
    safety:
      'Utilise une charge légère et arrête en cas de douleur au poignet ou à l’intérieur du coude.',
  }),
  sheet(57, {
    name: 'Curl inversé',
    aliases: ['Reverse curl', 'Curl prise pronation'],
    equipment: ['barbell'],
    primaryMuscles: ['forearms'],
    secondaryMuscles: ['biceps'],
    movementPattern: 'elbow_flexion',
    level: 'beginner',
    inputType: 'weight_reps',
    steps: [
      'Debout, saisis la barre en pronation, mains à largeur d’épaules.',
      'Garde les coudes collés au buste et les poignets droits.',
      'Expire en fléchissant les coudes pour monter la barre vers les épaules.',
      'Redescends lentement jusqu’à bras tendus.',
    ],
    mistakes: [
      'Plier les poignets vers l’arrière → garde-les droits, alignés avec l’avant-bras.',
      'Balancer le buste → serre les abdos et baisse la charge.',
      'Avancer les coudes → garde-les collés au buste.',
    ],
    variations: [
      'Plus facile : Curl inversé avec haltères légers',
      'Plus difficile : Curl inversé avec pause en haut',
      'Autre matériel : Curl marteau',
    ],
    loadAdvice: '3 séries de 10-15 répétitions, repos 60 s.',
    safety:
      'Choisis une charge plus légère qu’au curl classique et arrête en cas de douleur au poignet.',
  }),
  sheet(58, {
    name: 'Marche du fermier',
    aliases: ['Farmer walk', 'Marche avec charges'],
    equipment: ['dumbbell'],
    primaryMuscles: ['forearms'],
    secondaryMuscles: ['traps', 'abs'],
    movementPattern: 'core',
    level: 'beginner',
    inputType: 'distance',
    steps: [
      'Prends un haltère lourd dans chaque main, bras le long du corps.',
      'Redresse-toi, épaules basses et en arrière, abdos serrés.',
      'Marche d’un pas régulier sur la distance prévue, regard devant toi.',
      'Pose les haltères en gardant le dos droit, en fléchissant les genoux.',
    ],
    mistakes: [
      'Pencher le buste → garde-le droit, poitrine sortie.',
      'Hausser les épaules → garde-les basses.',
      'Faire de petits pas rapides et instables → marche d’un pas régulier.',
    ],
    variations: [
      'Plus facile : Marche du fermier avec haltères plus légers',
      'Plus difficile : Marche du fermier avec une charge plus lourde ou sur une plus longue distance',
      'Autre matériel : Farmer carry',
    ],
    loadAdvice: '3-4 allers de 20-40 mètres, repos 60-90 s.',
    safety:
      'Ramasse et repose les haltères en fléchissant les genoux, le dos droit, et ne dépasse pas ta limite de prise.',
  }),
];
