import { formatNumber } from '@/data';
import { Button, Card, Chip, Stat } from '@/ui';
import {
  diffDays,
  formatSigned,
  formatShortDayYear,
  relativeDayLabel,
  type CalorieAssessment,
  type Day,
  type GoalAssessment,
  type GoalStatus,
} from '../logic';
import { formatStored } from '../format';
import type { GoalView } from '../panels/goalView';
import styles from './GoalCard.module.css';

const STATUS_LABEL: Record<GoalStatus, string> = {
  reached: 'Atteint',
  ahead: 'En avance',
  on_track: 'Dans les temps',
  late: 'En retard',
  no_deadline: 'Sans date cible',
  no_data: 'Pas encore de mesure',
};

const CALORIE_STATUS_LABEL = {
  reached: 'Dans la cible',
  late: 'Hors cible',
  no_data: 'Pas encore de journal',
} as const;

export interface GoalCardProps {
  view: GoalView;
  today: Day;
  onEdit: () => void;
  /** Objectif de calories : moyenne récente et évaluation. */
  calories?: CalorieAssessment;
}

/** Phrase sur la date estimée d'atteinte, claire aussi quand les données manquent. */
function projectionText(a: GoalAssessment, today: Day): string {
  switch (a.projection.kind) {
    case 'reached':
      return 'Objectif atteint, bravo !';
    case 'eta':
      return `Au rythme actuel, tu l’atteindras vers le ${formatShortDayYear(a.projection.date)} (${relativeDayLabel(a.projection.date, today)}).`;
    case 'wrong_way':
      return 'Au rythme actuel, tu t’éloignes de ton objectif : aucune date estimée.';
    case 'stalled':
      return 'Pas de progression sur les dernières semaines : aucune date estimée.';
    case 'no_data':
      return a.current === null
        ? 'Aucune date estimée tant qu’il n’y a pas de mesure.'
        : 'Pas assez de mesures récentes pour estimer une date : il en faut au moins deux, espacées d’une semaine.';
  }
}

function rateText(a: GoalAssessment, view: GoalView): string {
  const { rate } = a;
  if (!rate) return 'Rythme récent : pas assez de mesures sur les 6 dernières semaines.';
  const per = formatSigned(view.quantity.toDisplay(rate.perWeek), (n) =>
    view.quantity.formatDisplay(n),
  );
  return `Rythme récent : ${per} par semaine (${rate.count} mesures sur les 6 dernières semaines).`;
}

function deadlineText(targetDate: Day | null, today: Day, reached: boolean): string {
  if (!targetDate) return 'Aucune date cible : ajoute-en une pour savoir si tu es dans les temps.';
  const when = `${formatShortDayYear(targetDate)} (${relativeDayLabel(targetDate, today)})`;
  if (!reached && diffDays(today, targetDate) < 0) return `Date cible dépassée : ${when}.`;
  return `Date cible : ${when}.`;
}

function basisText(a: GoalAssessment): string | null {
  if (a.basis === 'pace') return 'Statut calculé d’après ton rythme récent.';
  if (a.basis === 'plan')
    return 'Statut calculé d’après l’avancement prévu entre la création et la date cible (pas assez de mesures pour juger ton rythme).';
  return null;
}

export function GoalCard({ view, today, onEdit, calories }: GoalCardProps) {
  const { goal, quantity, assessment } = view;
  const heading = `${view.title} : ${view.targetText}`;

  if (goal.type === 'calories') {
    const c = calories;
    const status = c?.status ?? 'no_data';
    const ratio = c && c.average !== null ? Math.max(0, 1 - Math.abs(c.gap ?? 1)) : 0;
    return (
      <Card className={styles.card} aria-label={heading}>
        <header className={styles.head}>
          <h2 className={styles.title}>{heading}</h2>
          <Chip selected={status === 'reached'}>{CALORIE_STATUS_LABEL[status]}</Chip>
        </header>
        <Bar fraction={ratio} label="Proximité de la cible" />
        <div className={styles.values}>
          <Stat
            label="Moyenne récente"
            value={c && c.average !== null ? formatNumber(Math.round(c.average)) : '—'}
            unit={c && c.average !== null ? 'kcal' : undefined}
          />
          <Stat label="Cible" value={formatNumber(goal.targetValue)} unit="kcal" />
        </div>
        <ul className={styles.notes}>
          <li>
            {c && c.average !== null && c.gap !== null
              ? `Moyenne des jours renseignés sur les 7 derniers jours : ${
                  Math.abs(c.gap) < 0.005
                    ? 'pile sur ta cible'
                    : `${formatNumber(Math.round(Math.abs(c.gap) * 100))} % ${c.gap > 0 ? 'au-dessus' : 'en dessous'} de ta cible`
                }.`
              : view.missingHint}
          </li>
          {goal.targetDate && <li>{deadlineText(goal.targetDate, today, false)}</li>}
        </ul>
        <Button variant="secondary" onClick={onEdit}>
          Modifier
        </Button>
      </Card>
    );
  }

  const a = assessment;
  if (!a) return null;
  const note = basisText(a);
  return (
    <Card className={styles.card} aria-label={heading}>
      <header className={styles.head}>
        <h2 className={styles.title}>{heading}</h2>
        <Chip selected={a.status === 'reached'}>{STATUS_LABEL[a.status]}</Chip>
      </header>
      <Bar fraction={a.progress ?? 0} label="Progression de l’objectif" />
      <div className={styles.values}>
        <Stat
          label="Départ"
          value={a.start !== null ? formatNumber(quantity.toDisplay(a.start)) : '—'}
          unit={a.start !== null ? quantity.unit : undefined}
        />
        <Stat
          label="Actuel"
          value={a.current !== null ? formatNumber(quantity.toDisplay(a.current)) : '—'}
          unit={a.current !== null ? quantity.unit : undefined}
        />
        <Stat
          label="Cible"
          value={formatNumber(quantity.toDisplay(goal.targetValue))}
          unit={quantity.unit}
        />
      </div>
      {a.current === null ? (
        <p className={styles.hint}>{view.missingHint}</p>
      ) : (
        <ul className={styles.notes}>
          {a.remaining !== null && a.remaining > 0 && (
            <li>Il te reste {formatStored(quantity, a.remaining)} pour atteindre ta cible.</li>
          )}
          <li>{deadlineText(goal.targetDate, today, a.reached)}</li>
          {!a.reached && <li>{rateText(a, view)}</li>}
          <li>{projectionText(a, today)}</li>
          {note && <li className={styles.muted}>{note}</li>}
        </ul>
      )}
      <Button variant="secondary" onClick={onEdit}>
        Modifier
      </Button>
    </Card>
  );
}

function Bar({ fraction, label }: { fraction: number; label: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div
      className={styles.bar}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent} %`}
    >
      <div className={styles.fill} style={{ width: `${percent}%` }} />
      <span className={styles.percent}>{percent} %</span>
    </div>
  );
}
