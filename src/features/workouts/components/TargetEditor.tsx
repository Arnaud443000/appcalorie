import { useState } from 'react';
import { Input } from '@/ui';
import {
  formatField,
  formatRepRange,
  parseDecimal,
  parseRepRange,
  parseWholeNumber,
  type InputType,
} from '../logic';
import { NumberStepper } from './NumberStepper';
import styles from './TargetEditor.module.css';

export interface TargetEditorProps {
  inputType: InputType;
  /** Texte stocké dans le programme (`targetReps`). */
  value: string;
  onChange: (value: string) => void;
}

/** Fourchette de répétitions (ou durée, ou texte libre) selon le type de saisie de l'exercice. */
export function TargetEditor({ inputType, value, onChange }: TargetEditorProps) {
  if (inputType === 'duration') return <DurationTarget value={value} onChange={onChange} />;
  if (inputType === 'distance') {
    return (
      <Input
        label="Objectif (ex. 5 km)"
        value={value}
        maxLength={40}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return <RepsTarget value={value} onChange={onChange} />;
}

function RepsTarget({ value, onChange }: Pick<TargetEditorProps, 'value' | 'onChange'>) {
  const range = parseRepRange(value);
  const [min, setMin] = useState(range ? String(range.min) : '');
  const [max, setMax] = useState(range ? String(range.max) : '');

  function commit(nextMin: string, nextMax: string) {
    const a = parseWholeNumber(nextMin);
    const b = parseWholeNumber(nextMax);
    const lo = a && a > 0 ? a : null;
    const hi = b && b > 0 ? b : null;
    if (lo === null && hi === null) {
      onChange('');
      return;
    }
    const first = lo ?? (hi as number);
    const second = hi ?? first;
    onChange(formatRepRange(first, second));
    setMin(String(Math.min(first, second)));
    setMax(String(Math.max(first, second)));
  }

  return (
    <div className={styles.pair}>
      <NumberStepper
        label="Répétitions min"
        value={min}
        step={1}
        min={1}
        inputMode="numeric"
        onChange={setMin}
        onCommit={(text) => commit(text, max)}
      />
      <NumberStepper
        label="Répétitions max"
        value={max}
        step={1}
        min={1}
        inputMode="numeric"
        onChange={setMax}
        onCommit={(text) => commit(min, text)}
      />
    </div>
  );
}

function DurationTarget({ value, onChange }: Pick<TargetEditorProps, 'value' | 'onChange'>) {
  const parsed = parseDecimal(value.replace(/\s*s(ec(ondes?)?)?$/i, ''));
  const [seconds, setSeconds] = useState(parsed ? formatField(parsed) : '');
  return (
    <NumberStepper
      label="Durée cible (s)"
      value={seconds}
      step={5}
      min={5}
      inputMode="numeric"
      onChange={setSeconds}
      onCommit={(text) => {
        const n = parseWholeNumber(text);
        onChange(n && n > 0 ? `${n} s` : '');
      }}
    />
  );
}
