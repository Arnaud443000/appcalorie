import { sheet, type ExerciseSheet } from './types';

/** Full body (5 fiches). */
export const FULLBODY_SHEETS: ExerciseSheet[] = [
  sheet(116, {
    name: 'Burpees',
    aliases: ['Burpee'],
    equipment: ['bodyweight'],
    primaryMuscles: ['quads', 'chest'],
    secondaryMuscles: ['shoulders', 'triceps', 'abs', 'glutes'],
    movementPattern: 'squat',
    level: 'intermediate',
    inputType: 'reps',
    steps: [
      'Debout, pieds largeur d’épaules, fléchis les genoux et pose les mains au sol.',
      'Lance les pieds en arrière pour te retrouver en position de pompe.',
      'Descends la poitrine vers le sol (ou saute directement si c’est trop dur).',
      'Ramène les pieds vers les mains, puis saute en poussant les bras vers le haut.',
    ],
    mistakes: [
      'Laisser le bassin s’affaisser en position de pompe → serre les abdos et les fessiers.',
      'Aller trop vite et bâcler la technique → ralentis pour garder le dos gainé.',
      'Retomber lourdement → amortis en fléchissant les genoux.',
    ],
    variations: [
      'Plus facile : Burpees sans pompe ni saut',
      'Plus difficile : Burpees avec saut en hauteur',
      'Autre matériel : Burpees avec un haltère au sol',
    ],
    loadAdvice: '3-5 séries de 8-15 répétitions, repos 60-90 s.',
    safety:
      'Garde le dos gainé en position de pompe et amortis les réceptions pour ménager poignets et genoux.',
  }),
  sheet(117, {
    name: 'Thruster',
    aliases: ['Squat + développé', 'Barbell thruster'],
    equipment: ['barbell'],
    primaryMuscles: ['quads', 'shoulders'],
    secondaryMuscles: ['glutes', 'triceps', 'abs', 'traps'],
    movementPattern: 'squat',
    level: 'advanced',
    inputType: 'weight_reps',
    steps: [
      'Pose la barre sur le devant des épaules, coudes hauts, pieds largeur d’épaules.',
      'Descends en squat, dos droit, genoux dans l’axe des pieds.',
      'Remonte avec force et enchaîne en poussant la barre au-dessus de la tête.',
      'Termine bras tendus, debout, puis redescends la barre sur les épaules.',
    ],
    mistakes: [
      'Séparer le squat et le développé → enchaîne les deux en un mouvement continu.',
      'Pencher le buste en avant → garde les coudes hauts et la poitrine sortie.',
      'Prendre une charge trop lourde → commence léger.',
    ],
    variations: [
      'Plus facile : Thruster avec des haltères légers',
      'Plus difficile : Thruster avec une charge plus lourde',
      'Autre matériel : Thruster avec des haltères',
    ],
    loadAdvice: '3-5 séries de 5-10 répétitions, repos 90 s à 2 min.',
    safety:
      'Apprends d’abord le front squat et le développé séparément avec une charge légère, et garde le dos gainé.',
  }),
  sheet(118, {
    name: 'Farmer carry',
    aliases: ['Farmer’s walk', 'Marche chargée'],
    equipment: ['kettlebell'],
    primaryMuscles: ['forearms', 'traps'],
    secondaryMuscles: ['abs', 'glutes', 'lower_back', 'quads'],
    movementPattern: 'core',
    level: 'beginner',
    inputType: 'distance',
    steps: [
      'Ramasse une kettlebell lourde dans chaque main en fléchissant les genoux, dos droit.',
      'Redresse-toi, épaules basses et en arrière, abdos serrés.',
      'Marche d’un pas régulier sur la distance prévue, regard devant toi.',
      'Pose les charges en fléchissant les genoux, dos droit.',
    ],
    mistakes: [
      'Pencher le buste → garde-le droit, poitrine sortie.',
      'Hausser les épaules → garde-les basses.',
      'Faire de petits pas instables → marche d’un pas régulier.',
    ],
    variations: [
      'Plus facile : Farmer carry avec des charges plus légères',
      'Plus difficile : Farmer carry avec des charges plus lourdes ou sur une plus longue distance',
      'Autre matériel : Marche du fermier avec des haltères',
    ],
    loadAdvice: '3-4 allers de 20-40 mètres, repos 60-90 s.',
    safety:
      'Ramasse et repose les charges en fléchissant les genoux, le dos droit, et lâche-les si tu perds l’équilibre.',
  }),
  sheet(119, {
    name: 'Sled push',
    aliases: ['Poussée de traîneau', 'Prowler push'],
    equipment: ['machine'],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['calves', 'shoulders', 'abs', 'triceps'],
    movementPattern: 'squat',
    level: 'intermediate',
    inputType: 'distance',
    steps: [
      'Charge le traîneau, saisis les poignées bras tendus, buste penché à 45°.',
      'Garde le dos plat et les abdos serrés.',
      'Pousse en faisant de grands pas puissants, talons bien appuyés.',
      'Avance sur la distance prévue, sans relâcher la pression.',
    ],
    mistakes: [
      'Se redresser et perdre la poussée → garde le corps incliné à 45°.',
      'Arrondir le dos → garde le dos plat.',
      'Charger trop lourd → choisis une charge qui permet de garder une bonne technique.',
    ],
    variations: [
      'Plus facile : Sled push avec un traîneau léger',
      'Plus difficile : Sled push avec une charge plus lourde',
      'Autre matériel : Marche en fentes avec haltères',
    ],
    loadAdvice: '4-6 allers de 15-30 mètres, repos 60-90 s.',
    safety:
      'Garde le dos plat, évite les charges qui t’obligent à arrondir le dos et surveille l’espace devant toi.',
  }),
  sheet(120, {
    name: 'Battle ropes',
    aliases: ['Cordes ondulatoires', 'Cordes de combat'],
    equipment: ['cardio'],
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['abs', 'biceps', 'forearms', 'quads'],
    movementPattern: 'arm_raise',
    level: 'intermediate',
    inputType: 'duration',
    steps: [
      'Saisis une extrémité de la corde dans chaque main, pieds largeur d’épaules.',
      'Fléchis légèrement les genoux, buste droit, abdos serrés.',
      'Alterne les bras vers le haut et vers le bas pour créer des vagues.',
      'Garde un rythme régulier et respire sans retenir ton souffle.',
    ],
    mistakes: [
      'Arrondir le dos → garde le dos droit, abdos serrés.',
      'Bouger seulement les poignets → bouge les épaules et les bras.',
      'Retenir sa respiration → respire par à-coups réguliers.',
    ],
    variations: [
      'Plus facile : Battle ropes à faible amplitude',
      'Plus difficile : Battle ropes avec les deux bras en même temps',
      'Autre matériel : Corde à sauter',
    ],
    loadAdvice: '4-6 séries de 20-40 secondes, repos 30-60 s.',
    safety:
      'Garde les genoux souples et le dos droit, et arrête si tu sens une douleur à l’épaule.',
  }),
];
