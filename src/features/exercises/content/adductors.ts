import { sheet, type ExerciseSheet } from './types';

/** Adducteurs (2 fiches). */
export const ADDUCTORS_SHEETS: ExerciseSheet[] = [
  sheet(93, {
    name: 'Adduction machine',
    imageSlug: 'adduction-machine',
    aliases: ['Hip adduction machine', 'Machine adducteurs'],
    equipment: ['machine'],
    primaryMuscles: ['adductors'],
    secondaryMuscles: [],
    movementPattern: 'lunge',
    level: 'beginner',
    inputType: 'weight_reps',
    steps: [
      'Règle l’écartement de départ, assieds-toi dos plaqué, jambes contre les coussins.',
      'Saisis les poignées et garde le bassin stable.',
      'Expire en serrant les jambes l’une vers l’autre.',
      'Marque un court arrêt, puis écarte lentement les jambes.',
    ],
    mistakes: [
      'Partir trop écarté → règle un écartement confortable.',
      'Utiliser l’élan du buste → plaque le dos et baisse la charge.',
      'Laisser la charge écarter les jambes d’un coup → contrôle le retour en 2 secondes.',
    ],
    variations: [
      'Plus facile : Adduction avec charge réduite',
      'Plus difficile : Squat sumo',
      'Autre matériel : Squat sumo',
    ],
    loadAdvice: '3 séries de 12-20 répétitions, repos 60 s.',
    safety: 'Règle l’écartement de départ à ta souplesse pour ménager l’intérieur des cuisses.',
  }),
  sheet(94, {
    name: 'Squat sumo',
    imageSlug: 'squat-sumo',
    aliases: ['Sumo squat', 'Squat large'],
    equipment: ['dumbbell'],
    primaryMuscles: ['adductors', 'glutes'],
    secondaryMuscles: ['quads', 'hamstrings'],
    movementPattern: 'squat',
    level: 'beginner',
    inputType: 'weight_reps',
    steps: [
      'Écarte largement les pieds, pointes ouvertes à 45°, un haltère tenu entre les jambes.',
      'Garde le dos droit, abdos serrés, bras tendus.',
      'Inspire et descends en poussant les genoux dans l’axe des pieds.',
      'Descends jusqu’à ce que les cuisses soient parallèles au sol.',
      'Expire en remontant en serrant les fessiers.',
    ],
    mistakes: [
      'Laisser les genoux rentrer → pousse-les dans l’axe des pieds.',
      'Arrondir le dos → garde la poitrine haute.',
      'Décoller les talons → garde tout le pied au sol.',
    ],
    variations: [
      'Plus facile : Squat sumo au poids du corps',
      'Plus difficile : Squat sumo avec pause en bas',
      'Autre matériel : Squat sumo avec une kettlebell',
    ],
    loadAdvice: '3 séries de 10-15 répétitions, repos 90 s.',
    safety:
      'Garde les genoux dans l’axe des pieds et ne force pas si l’écartement te gêne la hanche.',
  }),
];
