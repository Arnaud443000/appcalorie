import { useId, type KeyboardEvent } from 'react';
import { stepText } from '../logic';
import styles from './NumberStepper.module.css';

export interface NumberStepperProps {
  /** Libellé visible et lu par les lecteurs d'écran, ex. « Charge (kg) ». */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Appelé quand la valeur est « finie » : fin de saisie ou clic sur + / −. */
  onCommit?: (value: string) => void;
  step: number;
  min?: number;
  max?: number;
  /** `decimal` pour les charges, `numeric` pour les nombres entiers. */
  inputMode?: 'decimal' | 'numeric';
  placeholder?: string;
}

/** Champ numérique pour téléphone : clavier adapté, boutons − et + de 44 px. */
export function NumberStepper({
  label,
  value,
  onChange,
  onCommit,
  step,
  min = 0,
  max,
  inputMode = 'decimal',
  placeholder,
}: NumberStepperProps) {
  const id = useId();

  function bump(delta: number) {
    const next = stepText(value, delta, min, max);
    onChange(next);
    onCommit?.(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') onCommit?.(event.currentTarget.value);
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <button
          type="button"
          className={styles.step}
          aria-label={`Moins : ${label}`}
          onClick={() => bump(-step)}
        >
          −
        </button>
        <input
          id={id}
          className={styles.input}
          type="text"
          inputMode={inputMode}
          enterKeyHint="done"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onCommit?.(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className={styles.step}
          aria-label={`Plus : ${label}`}
          onClick={() => bump(step)}
        >
          +
        </button>
      </div>
    </div>
  );
}
