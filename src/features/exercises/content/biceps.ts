import { sheet, type ExerciseSheet } from './types';

/** Biceps (8 fiches). */
export const BICEPS_SHEETS: ExerciseSheet[] = [
  sheet(41, {
    name: 'Curl barre droite',
    aliases: ['Barbell curl', 'Curl à la barre'],
    equipment: ['barbell'],
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    movementPattern: 'elbow_flexion',
    level: 'beginner',
    inputType: 'weight_reps',
    steps: [
      'Debout, barre en supination à largeur d’épaules, bras tendus devant les cuisses.',
      'Garde les coudes collés au buste et les abdos serrés.',
      'Expire en fléchissant les coudes pour monter la barre vers les épaules.',
      'Marque un court arrêt en haut, puis redescends lentement.',
    ],
    mistakes: [
      'Balancer le buste pour monter la barre → baisse la charge et serre les abdos.',
      'Avancer les coudes → garde-les collés au buste.',
      'Redescendre trop vite → prends 2 à 3 secondes pour la descente.',
    ],
    variations: [
      'Plus facile : Curl haltères alternés',
      'Plus difficile : Curl barre avec pause en haut',
      'Autre matériel : Curl barre EZ',
    ],
    loadAdvice: '3-4 séries de 8-12 répétitions, repos 60-90 s.',
    safety: 'Garde les poignets neutres et arrête en cas de douleur à l’avant du coude.',
  }),
  sheet(42, {
    name: 'Curl barre EZ',
    aliases: ['EZ bar curl', 'Curl barre à cambrure'],
    equipment: ['barbell'],
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    movementPattern: 'elbow_flexion',
    level: 'beginner',
    inputType: 'weight_reps',
    steps: [
      'Debout, prends la barre EZ aux creux intérieurs, bras tendus devant les cuisses.',
      'Garde les coudes collés au buste et les abdos serrés.',
      'Expire en fléchissant les coudes pour monter la barre vers les épaules.',
      'Marque un court arrêt en haut, puis redescends lentement.',
    ],
    mistakes: [
      'Balancer le buste → serre les abdos et baisse la charge.',
      'Écarter les coudes sur les côtés → garde-les collés au buste.',
      'Faire des demi-répétitions → descends jusqu’à bras presque tendus.',
    ],
    variations: [
      'Plus facile : Curl haltères alternés',
      'Plus difficile : Curl barre EZ avec pause en haut',
      'Autre matériel : Curl poulie basse',
    ],
    loadAdvice: '3-4 séries de 8-12 répétitions, repos 60-90 s.',
    safety:
      'La barre EZ soulage les poignets, mais arrête quand même en cas de douleur à l’avant du coude.',
  }),
  sheet(4, {
    name: 'Curl haltères alternés',
    aliases: ['Dumbbell curl', 'Curl biceps', 'Alternating curl'],
    equipment: ['dumbbell'],
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    movementPattern: 'elbow_flexion',
    level: 'beginner',
    inputType: 'weight_reps',
    steps: [
      'Debout, un haltère dans chaque main, bras le long du corps, paumes vers l’avant.',
      'Garde les coudes collés au buste.',
      'Expire en fléchissant un coude pour monter l’haltère vers l’épaule.',
      'Redescends lentement jusqu’à bras tendu, puis monte l’autre bras.',
    ],
    mistakes: [
      'Balancer le buste pour monter la charge → baisse la charge et serre les abdos.',
      'Avancer le coude en haut du mouvement → garde-le collé au buste.',
      'Redescendre trop vite → prends 2 à 3 secondes pour la descente.',
    ],
    variations: [
      'Plus facile : Curl haltères avec charge réduite',
      'Plus difficile : Curl incliné',
      'Autre matériel : Curl barre EZ',
    ],
    loadAdvice: '3-4 séries de 8-15 répétitions, repos 60-90 s.',
    safety: 'Garde les poignets neutres et arrête en cas de douleur à l’avant du coude.',
  }),
];
