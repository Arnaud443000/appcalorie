import { useState } from 'react';
import { foodRepo, parseDecimal, type Food } from '@/data';
import { Button, Input } from '@/ui';
import styles from './CreateFoodForm.module.css';

export interface CreateFoodFormProps {
  initialName: string;
  onBack: () => void;
  onCreated: (food: Food) => void;
}

const NUMBER_FIELDS = [
  { key: 'kcal', label: 'Calories', suffix: 'kcal', required: true },
  { key: 'proteinG', label: 'Protéines', suffix: 'g', required: true },
  { key: 'carbsG', label: 'Glucides', suffix: 'g', required: true },
  { key: 'fatG', label: 'Lipides', suffix: 'g', required: true },
  { key: 'fiberG', label: 'Fibres (facultatif)', suffix: 'g', required: false },
  { key: 'servingG', label: 'Portion habituelle (facultatif)', suffix: 'g', required: false },
] as const;

type NumberKey = (typeof NUMBER_FIELDS)[number]['key'];

/** Création manuelle d'un aliment (valeurs pour 100 g). */
export function CreateFoodForm({ initialName, onBack, onCreated }: CreateFoodFormProps) {
  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState('');
  const [values, setValues] = useState<Record<NumberKey, string>>({
    kcal: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    fiberG: '',
    servingG: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const parsed = Object.fromEntries(
    NUMBER_FIELDS.map(({ key }) => [key, parseDecimal(values[key])]),
  ) as Record<NumberKey, number | null>;

  /** Message d'erreur d'un champ numérique, ou `undefined` s'il est correct. */
  function errorOf(key: NumberKey, required: boolean): string | undefined {
    const text = values[key].trim();
    if (text === '') return required ? 'Obligatoire' : undefined;
    const value = parsed[key];
    if (value === null || value < 0) return 'Nombre invalide';
    if (key === 'servingG' && value === 0) return 'Doit être supérieur à 0';
    if (key !== 'kcal' && key !== 'servingG' && value > 100) return 'Maximum 100 g pour 100 g';
    if (key === 'kcal' && value > 900) return 'Maximum 900 kcal pour 100 g';
    return undefined;
  }

  const nameError = name.trim() === '' ? 'Obligatoire' : undefined;
  const hasError =
    nameError !== undefined || NUMBER_FIELDS.some((f) => errorOf(f.key, f.required) !== undefined);

  async function submit() {
    setSubmitted(true);
    setFailure(null);
    if (hasError) return;
    try {
      const food = await foodRepo.create({
        name: name.trim(),
        brand: brand.trim(),
        barcode: null,
        kcal: parsed.kcal ?? 0,
        proteinG: parsed.proteinG ?? 0,
        carbsG: parsed.carbsG ?? 0,
        fatG: parsed.fatG ?? 0,
        fiberG: parsed.fiberG,
        servingG: parsed.servingG,
        source: 'manual',
        average: null,
      });
      onCreated(food);
    } catch {
      setFailure('Impossible d’enregistrer cet aliment. Vérifie les valeurs.');
    }
  }

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <button type="button" className={styles.back} onClick={onBack}>
        ← Retour
      </button>
      <p className={styles.help}>Saisis les valeurs pour 100 g, comme sur l’emballage.</p>
      <Input
        label="Nom"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={submitted ? nameError : undefined}
      />
      <Input label="Marque (facultatif)" value={brand} onChange={(e) => setBrand(e.target.value)} />
      {NUMBER_FIELDS.map(({ key, label, suffix, required }) => (
        <Input
          key={key}
          label={label}
          suffix={suffix}
          inputMode="decimal"
          autoComplete="off"
          value={values[key]}
          onChange={(event) => setValues((v) => ({ ...v, [key]: event.target.value }))}
          error={submitted ? errorOf(key, required) : undefined}
        />
      ))}
      {failure && (
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      )}
      <Button type="submit" block>
        Créer l’aliment
      </Button>
    </form>
  );
}
