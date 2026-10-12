import { sheet, type ExerciseSheet } from './types';

/** Abdos (10 fiches). */
export const ABS_SHEETS: ExerciseSheet[] = [
  sheet(59, {
    name: 'Crunch',
    aliases: ['Crunch au sol', 'Abdominaux'],
    equipment: ['bodyweight'],
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    movementPattern: 'core',
    level: 'beginner',
    inputType: 'reps',
    steps: [
      'Allonge-toi sur le dos, genoux fléchis, pieds à plat au sol.',
      'Pose les mains contre les tempes ou croise-les sur la poitrine.',
      'Expire en enroulant les épaules vers le bassin, bas du dos au sol.',
      'Marque un court arrêt en contractant les abdos, puis redescends lentement.',
    ],
    mistakes: [
      'Tirer sur la nuque avec les mains → garde les mains légères contre les tempes.',
      'Monter tout le buste jusqu’aux genoux → décolle seulement les omoplates.',
      'Aller trop vite → prends 2 secondes à la montée et à la descente.',
    ],
    variations: [
      'Plus facile : Crunch avec amplitude courte, bras tendus devant toi',
      'Plus difficile : Crunch à la poulie',
      'Autre matériel : Crunch avec un disque sur la poitrine',
    ],
    loadAdvice: '3 séries de 12-20 répétitions, repos 45-60 s.',
    safety:
      'Garde la nuque détendue et arrête si tu ressens une gêne dans le cou ou le bas du dos.',
  }),
  sheet(60, {
    name: 'Crunch à la poulie',
    aliases: ['Cable crunch', 'Crunch poulie haute'],
    equipment: ['cable'],
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    movementPattern: 'core',
    level: 'intermediate',
    inputType: 'weight_reps',
    steps: [
      'Fixe une corde à la poulie haute et mets-toi à genoux face à la machine.',
      'Tiens la corde de chaque côté de la tête, coudes vers l’avant.',
      'Expire en enroulant le buste vers le bas, coudes vers les genoux.',
      'Marque un court arrêt, puis remonte lentement sans cambrer.',
    ],
    mistakes: [
      'Tirer avec les bras → garde les mains fixes à hauteur de la tête.',
      'Pivoter à partir des hanches → enroule la colonne, les hanches restent fixes.',
      'Prendre une charge trop lourde → baisse la charge pour sentir les abdos.',
    ],
    variations: [
      'Plus facile : Crunch',
      'Plus difficile : Crunch à la poulie avec pause en bas',
      'Autre matériel : Crunch avec un disque sur la poitrine',
    ],
    loadAdvice: '3 séries de 10-15 répétitions, repos 60 s.',
    safety: 'Arrondis la colonne en douceur sans à-coup et arrête si le bas du dos te gêne.',
  }),
  sheet(61, {
    name: 'Relevé de jambes suspendu',
    aliases: ['Hanging leg raise', 'Relevé de jambes à la barre'],
    equipment: ['bodyweight'],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['forearms'],
    movementPattern: 'core',
    level: 'advanced',
    inputType: 'reps',
    steps: [
      'Suspends-toi à une barre, bras tendus, épaules basses.',
      'Serre les abdos et garde les jambes tendues.',
      'Expire en montant les jambes jusqu’à l’horizontale ou plus haut.',
      'Redescends lentement, sans balancer le corps.',
    ],
    mistakes: [
      'Se balancer pour prendre de l’élan → gaine et contrôle la descente.',
      'Plier les genoux dès le début → garde les jambes tendues si tu en es capable.',
      'Relâcher les épaules → garde-les basses et actives.',
    ],
    variations: [
      'Plus facile : Relevé de genoux',
      'Plus difficile : Relevé de jambes suspendu jusqu’à la barre',
      'Autre matériel : Relevé de jambes sur chaise romaine',
    ],
    loadAdvice: '3 séries de 8-15 répétitions, repos 60-90 s.',
    safety:
      'Évite les à-coups pour ménager le bas du dos, et arrête si tu sens une gêne aux épaules.',
  }),
  sheet(62, {
    name: 'Relevé de genoux',
    aliases: ['Hanging knee raise', 'Relevé de genoux suspendu'],
    equipment: ['bodyweight'],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['forearms'],
    movementPattern: 'core',
    level: 'beginner',
    inputType: 'reps',
    steps: [
      'Suspends-toi à une barre, ou appuie-toi sur les coudes à la chaise romaine.',
      'Garde le dos plaqué et les épaules basses.',
      'Expire en montant les genoux vers la poitrine, en enroulant le bassin.',
      'Redescends lentement, sans balancer le corps.',
    ],
    mistakes: [
      'Se balancer → gaine et contrôle la descente.',
      'Monter seulement les cuisses sans enrouler le bassin → remonte le bassin en fin de mouvement.',
      'Redescendre brutalement → prends 2 secondes pour la descente.',
    ],
    variations: [
      'Plus facile : Relevé de genoux allongé au sol',
      'Plus difficile : Relevé de jambes suspendu',
      'Autre matériel : Relevé de genoux sur chaise romaine',
    ],
    loadAdvice: '3 séries de 10-15 répétitions, repos 60 s.',
    safety:
      'Évite les à-coups pour ménager le bas du dos et arrête si tu sens une gêne aux épaules.',
  }),
];
