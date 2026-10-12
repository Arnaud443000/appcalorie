import { formatNumber } from '@/data';
import { Button, Card } from '@/ui';
import { MACRO_ROWS, remainingKcal, type EffectiveTargets, type Nutrition } from '../logic';
import { ProgressBar } from './ProgressBar';
import styles from './TotalsCard.module.css';

export interface TotalsCardProps {
  totals: Nutrition;
  goalKcal: number | null;
  macroTargets: EffectiveTargets;
  onEditGoals: () => void;
}

/** Totaux du jour : calories par rapport à l'objectif, reste à manger, macros par rapport aux repères. */
export function TotalsCard({ totals, goalKcal, macroTargets, onEditGoals }: TotalsCardProps) {
  const remaining = remainingKcal(goalKcal, totals.kcal);
  const eaten = Math.round(totals.kcal);
  return (
    <Card aria-label="Totaux du jour" className={styles.card}>
      <div className={styles.head}>
        <p className={styles.kcal}>
          <span className={styles.big}>{formatNumber(eaten)}</span>
          <span className={styles.unit}>
            {goalKcal !== null ? ` / ${formatNumber(goalKcal)} kcal` : ' kcal'}
          </span>
        </p>
        {remaining && (
          <p className={styles.remaining} data-over={remaining.over > 0}>
            {remaining.over > 0
              ? `Dépassé de ${formatNumber(remaining.over)} kcal`
              : `Reste ${formatNumber(remaining.kcal)} kcal`}
          </p>
        )}
      </div>
      <ProgressBar
        label="Calories"
        value={totals.kcal}
        target={goalKcal}
        valueText={`${eaten} sur ${goalKcal ?? '?'} kcal`}
      />
      {goalKcal === null && (
        <p className={styles.hint}>
          Fixe un objectif de calories pour voir ce qu’il te reste à manger.
        </p>
      )}

      <ul className={styles.macros}>
        {MACRO_ROWS.map(({ key, label }) => {
          const target = macroTargets[key];
          const value = totals[key];
          return (
            <li key={key} className={styles.macro}>
              <div className={styles.macroHead}>
                <span>{label}</span>
                <span className={styles.macroValue}>
                  {formatNumber(value)}
                  {target !== null ? ` / ${formatNumber(target)}` : ''} g
                </span>
              </div>
              <ProgressBar
                label={label}
                value={value}
                target={target}
                valueText={`${formatNumber(value)} sur ${target ?? '?'} g`}
              />
            </li>
          );
        })}
      </ul>

      <Button variant="secondary" block className={styles.edit} onClick={onEditGoals}>
        Mes objectifs
      </Button>
    </Card>
  );
}
