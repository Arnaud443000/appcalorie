import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  ListRow,
  NumberStepper,
  Sheet,
  Stat,
  Tabs,
  ToastProvider,
  useToast,
} from '../index';

describe('Composants UI', () => {
  it('Button déclenche son action et est de type button par défaut', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Valider</Button>);
    const button = screen.getByRole('button', { name: 'Valider' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('Card, Stat et EmptyState affichent leur contenu', () => {
    render(
      <Card>
        <Stat label="Poids" value={78.4} unit="kg" />
        <EmptyState title="Vide" message="Rien ici" />
      </Card>,
    );
    expect(screen.getByText('78.4')).toBeInTheDocument();
    expect(screen.getByText('Poids')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vide' })).toBeInTheDocument();
  });

  it('Chip cliquable indique son état', async () => {
    function Toggle() {
      const [on, setOn] = useState(false);
      return (
        <Chip selected={on} onClick={() => setOn(!on)}>
          Haltères
        </Chip>
      );
    }
    render(<Toggle />);
    const chip = screen.getByRole('button', { name: 'Haltères' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('Tabs se pilote au clic et aux flèches', async () => {
    const items = [
      { id: 'a', label: 'Jour' },
      { id: 'b', label: 'Semaine' },
      { id: 'c', label: 'Mois' },
    ] as const;
    function Demo() {
      const [value, setValue] = useState<'a' | 'b' | 'c'>('a');
      return <Tabs label="Période" items={items} value={value} onChange={setValue} />;
    }
    render(<Demo />);
    await userEvent.click(screen.getByRole('tab', { name: 'Semaine' }));
    expect(screen.getByRole('tab', { name: 'Semaine' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Mois' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Mois' })).toHaveFocus();
  });

  it('Input relie son libellé et son erreur', () => {
    render(<Input label="Poids" suffix="kg" error="Valeur invalide" />);
    const input = screen.getByLabelText('Poids');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Valeur invalide');
  });

  it('ListRow cliquable est un bouton', async () => {
    const onClick = vi.fn();
    render(<ListRow title="Squat" subtitle="Quadriceps" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: /Squat/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('Sheet se ferme avec Échap et rend le focus', async () => {
    function Demo() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Ouvrir</Button>
          <Sheet open={open} onClose={() => setOpen(false)} title="Options">
            <Button>Action</Button>
          </Sheet>
        </>
      );
    }
    render(<Demo />);
    const opener = screen.getByRole('button', { name: 'Ouvrir' });
    await userEvent.click(opener);
    expect(screen.getByRole('dialog', { name: 'Options' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('NumberStepper : + et − modifient la valeur et la valident', async () => {
    const user = userEvent.setup();
    const committed = vi.fn();
    function Demo() {
      const [value, setValue] = useState('60');
      return (
        <NumberStepper
          label="Charge (kg)"
          value={value}
          step={2.5}
          onChange={setValue}
          onCommit={committed}
        />
      );
    }
    render(<Demo />);
    await user.click(screen.getByRole('button', { name: 'Plus : Charge (kg)' }));
    expect(screen.getByLabelText('Charge (kg)')).toHaveValue('62,5');
    expect(committed).toHaveBeenLastCalledWith('62,5');
    await user.click(screen.getByRole('button', { name: 'Moins : Charge (kg)' }));
    await user.click(screen.getByRole('button', { name: 'Moins : Charge (kg)' }));
    expect(screen.getByLabelText('Charge (kg)')).toHaveValue('57,5');
  });

  it('Toast affiche un message puis le retire', () => {
    vi.useFakeTimers();
    function Demo() {
      const toast = useToast();
      return <Button onClick={() => toast.show('Enregistré')}>Go</Button>;
    }
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    act(() => screen.getByRole('button', { name: 'Go' }).click());
    expect(screen.getByRole('status')).toHaveTextContent('Enregistré');
    act(() => vi.advanceTimersByTime(3500));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    vi.useRealTimers();
  });
});
