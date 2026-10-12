import { describe, expect, it } from 'vitest';
import { assessCalorieGoal, assessGoal, recentDailyAverage, startValue } from './goals';
import type { SeriesPoint } from './series';

const p = (date: string, value: number): SeriesPoint => ({ date, value });
const today = '2026-10-12';

/** Une pesée par semaine, la dernière aujourd'hui. */
function weekly(values: number[]): SeriesPoint[] {
  const end = Date.UTC(2026, 9, 12);
  return values.map((value, i) => ({
    date: new Date(end - (values.length - 1 - i) * 7 * 86_400_000).toISOString().slice(0, 10),
    value,
  }));
}

describe('startValue', () => {
  const series = [p('2026-09-01', 85), p('2026-09-15', 83), p('2026-10-05', 80)];
  it('dernière mesure au plus tard le jour de création', () => {
    expect(startValue(series, '2026-09-20')).toBe(83);
    expect(startValue(series, '2026-09-15')).toBe(83);
  });
  it('sinon la première mesure après la création', () => {
    expect(startValue(series, '2026-08-01')).toBe(85);
  });
  it('null sans mesure', () => {
    expect(startValue([], '2026-09-20')).toBeNull();
  });
});

describe('assessGoal — sans données', () => {
  it('aucune mesure : pas d’erreur, statut « pas de données »', () => {
    const a = assessGoal({
      series: [],
      target: 75,
      targetDate: '2026-12-31',
      createdDay: '2026-09-01',
      today,
    });
    expect(a.status).toBe('no_data');
    expect(a.current).toBeNull();
    expect(a.start).toBeNull();
    expect(a.progress).toBeNull();
    expect(a.remaining).toBeNull();
    expect(a.projection.kind).toBe('no_data');
  });
  it('mesures seulement dans le futur : traitées comme absentes', () => {
    const a = assessGoal({
      series: [p('2027-01-01', 80)],
      target: 75,
      targetDate: null,
      createdDay: '2026-09-01',
      today,
    });
    expect(a.status).toBe('no_data');
  });
});

describe('assessGoal — objectif à atteindre', () => {
  it('perte de poids atteinte', () => {
    const a = assessGoal({
      series: weekly([80, 78, 74.8]),
      target: 75,
      targetDate: '2026-12-01',
      createdDay: '2026-09-28',
      today,
    });
    expect(a.direction).toBe('down');
    expect(a.reached).toBe(true);
    expect(a.status).toBe('reached');
    expect(a.progress).toBe(1);
    expect(a.remaining).toBe(0);
  });
  it('prise de charge atteinte', () => {
    const a = assessGoal({
      series: weekly([90, 95, 100]),
      target: 100,
      targetDate: null,
      createdDay: '2026-09-28',
      today,
    });
    expect(a.direction).toBe('up');
    expect(a.status).toBe('reached');
  });
  it('avancement partiel : départ, actuel, cible, reste, barre', () => {
    // Départ 80 (création le 14/09), maintenant 77,5, cible 75 : moitié du chemin.
    const series = [p('2026-09-14', 80), p('2026-09-28', 79), p('2026-10-12', 77.5)];
    const a = assessGoal({ series, target: 75, targetDate: null, createdDay: '2026-09-14', today });
    expect(a.start).toBe(80);
    expect(a.current).toBe(77.5);
    expect(a.progress).toBeCloseTo(0.5);
    expect(a.remaining).toBeCloseTo(2.5);
    expect(a.status).toBe('no_deadline');
  });
  it('avancement négatif (on s’éloigne) : barre à 0', () => {
    const series = [p('2026-09-14', 80), p('2026-10-12', 82)];
    const a = assessGoal({ series, target: 75, targetDate: null, createdDay: '2026-09-14', today });
    expect(a.progress).toBe(0);
  });
  it('départ égal à la cible : déjà atteint', () => {
    const a = assessGoal({
      series: [p('2026-09-14', 80)],
      target: 80,
      targetDate: null,
      createdDay: '2026-09-14',
      today,
    });
    expect(a.reached).toBe(true);
  });
});

describe('assessGoal — statut avec date cible (rythme)', () => {
  // −1 kg / semaine : de 80 à 75 en 5 semaines (35 jours).
  const series = weekly([82, 81, 80]);
  const base = { series, target: 75, createdDay: '2026-09-28', today };

  it('en avance : atteint bien avant la date', () => {
    expect(assessGoal({ ...base, targetDate: '2027-01-31' }).status).toBe('ahead');
  });
  it('dans les temps : atteint à quelques jours de la date', () => {
    const a = assessGoal({ ...base, targetDate: '2026-11-18' });
    expect(a.status).toBe('on_track');
    expect(a.basis).toBe('pace');
    expect(a.projection).toMatchObject({ kind: 'eta', days: 35 });
  });
  it('en retard : atteint bien après la date', () => {
    expect(assessGoal({ ...base, targetDate: '2026-10-30' }).status).toBe('late');
  });
  it('en retard : le rythme éloigne de la cible', () => {
    const a = assessGoal({ ...base, series: weekly([80, 81, 82]), targetDate: '2027-06-01' });
    expect(a.status).toBe('late');
    expect(a.projection.kind).toBe('wrong_way');
  });
  it('en retard : date dépassée sans avoir atteint la cible', () => {
    expect(assessGoal({ ...base, targetDate: '2026-10-01' }).status).toBe('late');
    expect(assessGoal({ ...base, targetDate: today }).status).toBe('late');
  });
  it('atteint même si la date est dépassée', () => {
    const a = assessGoal({ ...base, series: weekly([78, 76, 74]), targetDate: '2026-10-01' });
    expect(a.status).toBe('reached');
  });
});

describe('assessGoal — sans rythme mesurable (avancement prévu)', () => {
  it('une seule mesure, début de parcours : dans les temps', () => {
    const a = assessGoal({
      series: [p('2026-10-10', 80)],
      target: 75,
      targetDate: '2027-04-10',
      createdDay: '2026-10-10',
      today,
    });
    expect(a.rate).toBeNull();
    expect(a.status).toBe('on_track');
    expect(a.basis).toBe('plan');
  });
  it('une seule mesure, mi-parcours dépassé sans progrès : en retard', () => {
    const a = assessGoal({
      series: [p('2026-06-01', 80), p('2026-10-12', 80)],
      target: 75,
      targetDate: '2026-12-01',
      createdDay: '2026-06-01',
      today,
    });
    expect(a.status).toBe('late');
  });
  it('en avance sur le plan', () => {
    const a = assessGoal({
      series: [p('2026-10-10', 80), p('2026-10-12', 76)],
      target: 75,
      targetDate: '2027-04-10',
      createdDay: '2026-10-10',
      today,
    });
    expect(a.basis).toBe('plan');
    expect(a.status).toBe('ahead');
  });
  it('date cible le lendemain de la création, aucun progrès attendu encore', () => {
    const a = assessGoal({
      series: [p('2026-10-10', 80)],
      target: 75,
      targetDate: '2026-10-11',
      createdDay: '2026-10-10',
      today: '2026-10-10',
    });
    expect(a.status).toBe('on_track');
  });
});

describe('assessGoal — charge (valeur qui monte)', () => {
  it('projette la date d’atteinte', () => {
    const series = weekly([80, 82.5, 85, 87.5]);
    const a = assessGoal({
      series,
      target: 100,
      targetDate: '2027-01-31',
      createdDay: '2026-09-21',
      today,
    });
    expect(a.direction).toBe('up');
    expect(a.start).toBe(80);
    expect(a.current).toBe(87.5);
    expect(a.rate?.perWeek).toBeCloseTo(2.5);
    expect(a.projection).toMatchObject({ kind: 'eta', days: 35 });
    expect(a.status).toBe('ahead');
  });
});

describe('objectif de calories', () => {
  it('dans la cible à ±5 %', () => {
    expect(assessCalorieGoal(2000, 2000).status).toBe('reached');
    expect(assessCalorieGoal(2090, 2000).status).toBe('reached');
    expect(assessCalorieGoal(1910, 2000).status).toBe('reached');
  });
  it('hors cible', () => {
    const a = assessCalorieGoal(2400, 2000);
    expect(a.status).toBe('late');
    expect(a.gap).toBeCloseTo(0.2);
    expect(assessCalorieGoal(1500, 2000).gap).toBeCloseTo(-0.25);
  });
  it('sans journal : pas de données', () => {
    expect(assessCalorieGoal(null, 2000).status).toBe('no_data');
  });
  it('moyenne des 7 derniers jours renseignés, sans aujourd’hui s’il y en a d’autres', () => {
    const daily = [
      p('2026-10-04', 3000), // trop ancien (8 jours)
      p('2026-10-09', 2000),
      p('2026-10-10', 2200),
      p('2026-10-12', 500), // aujourd'hui, journée entamée
    ];
    expect(recentDailyAverage(daily, today)).toBe(2100);
  });
  it('seulement aujourd’hui : on l’utilise ; aucun jour : null', () => {
    expect(recentDailyAverage([p(today, 800)], today)).toBe(800);
    expect(recentDailyAverage([], today)).toBeNull();
    expect(recentDailyAverage([p('2026-01-01', 2000)], today)).toBeNull();
  });
});
