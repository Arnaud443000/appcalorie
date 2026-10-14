import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LineChart, type ChartPoint } from './LineChart';

const format = (v: number) => `${String(v).replace('.', ',')} kg`;
const point = (date: string, value: number): ChartPoint => ({ date, value });

function chart(points: ChartPoint[], extra: Partial<Parameters<typeof LineChart>[0]> = {}) {
  return render(
    <LineChart
      title="Courbe de poids"
      series={[{ id: 'w', name: 'Poids', points }]}
      formatValue={format}
      emptyMessage="Rien à afficher pour le moment."
      {...extra}
    />,
  );
}

describe('LineChart', () => {
  it('état vide : un message, pas de graphique ni d’erreur', () => {
    const { container } = chart([]);
    expect(screen.getByText('Rien à afficher pour le moment.')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('button', { name: /tableau/ })).toBeNull();
  });

  it('un seul point : la valeur, un message, pas de courbe', () => {
    const { container } = chart([point('2026-10-12', 80)]);
    expect(screen.getByText('80 kg')).toBeInTheDocument();
    expect(screen.getByText(/Une seule valeur pour l’instant/)).toBeInTheDocument();
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });

  it('deux points : courbe, points et description pour les lecteurs d’écran', () => {
    const { container } = chart([point('2026-10-01', 80), point('2026-10-12', 78)]);
    expect(container.querySelectorAll('circle')).toHaveLength(2);
    expect(container.querySelector('path')).toHaveAttribute('d');
    const figure = screen.getByRole('figure', { name: 'Courbe de poids' });
    expect(figure).toHaveAccessibleDescription(/2 mesures.*Dernière valeur : 78 kg/);
    // Le dessin lui-même est masqué aux lecteurs d'écran : l'information passe par le texte et le tableau.
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('affiche la dernière valeur par défaut', () => {
    chart([point('2026-10-01', 80), point('2026-10-12', 78)]);
    expect(screen.getByText(/Dernière valeur · 12 oct\. 2026/)).toBeInTheDocument();
    expect(screen.getByText('78 kg')).toBeInTheDocument();
  });

  it('le clavier parcourt les valeurs (flèches, début, fin, Échap)', async () => {
    const user = userEvent.setup();
    chart([point('2026-10-01', 80), point('2026-10-05', 79), point('2026-10-12', 78)]);
    const plot = screen.getByRole('group', { name: /Courbe de poids/ });
    await user.click(plot);
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('79 kg')).toBeInTheDocument();
    expect(screen.getByText('5 oct. 2026')).toBeInTheDocument();
    await user.keyboard('{Home}');
    expect(screen.getByText('80 kg')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}'); // déjà au début
    expect(screen.getByText('80 kg')).toBeInTheDocument();
    await user.keyboard('{End}');
    expect(screen.getByText('78 kg')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}{Escape}');
    expect(screen.getByText(/Dernière valeur ·/)).toBeInTheDocument();
  });

  it('toucher la courbe affiche la valeur et la date du point le plus proche', () => {
    const { container } = chart([point('2026-10-01', 80), point('2026-10-12', 78)]);
    const hit = container.querySelector('rect') as SVGRectElement;
    // 340 px par défaut : marge gauche ~34-46 px, zone de tracé jusqu'à 324 px.
    fireEvent.pointerDown(hit, { clientX: 50, pointerType: 'touch' });
    expect(screen.getByText('80 kg')).toBeInTheDocument();
    expect(screen.getByText('1 oct. 2026')).toBeInTheDocument();
    fireEvent.pointerDown(hit, { clientX: 320, pointerType: 'touch' });
    expect(screen.getByText('78 kg')).toBeInTheDocument();
  });

  it('ligne d’objectif : étiquette dans le dessin et dans la légende', () => {
    const { container } = chart([point('2026-10-01', 80), point('2026-10-12', 79)], {
      goal: { value: 75, label: 'Objectif 75 kg' },
    });
    expect(container.querySelectorAll('svg text')).not.toHaveLength(0);
    expect(within(container).getAllByText('Objectif 75 kg')).toHaveLength(2);
  });

  it('deuxième courbe (moyenne) : légende, lecture et colonne du tableau', async () => {
    const user = userEvent.setup();
    render(
      <LineChart
        title="Courbe de poids"
        series={[
          { id: 'w', name: 'Poids', points: [point('2026-10-01', 80), point('2026-10-02', 82)] },
          {
            id: 'a',
            name: 'Moyenne 7 jours',
            variant: 'average',
            points: [point('2026-10-01', 80), point('2026-10-02', 81)],
          },
        ]}
        formatValue={format}
        emptyMessage="—"
      />,
    );
    expect(screen.getByText('Moyenne 7 jours : 81 kg')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Afficher le tableau' }));
    expect(screen.getByRole('columnheader', { name: 'Moyenne 7 jours' })).toBeInTheDocument();
  });

  it('tableau masquable, du plus récent au plus ancien', async () => {
    const user = userEvent.setup();
    chart([point('2026-10-01', 80), point('2026-10-12', 78)]);
    const toggle = screen.getByRole('button', { name: 'Afficher le tableau' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table')).toBeNull();
    await user.click(toggle);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3); // en-tête + 2 valeurs
    expect(rows[1]).toHaveTextContent('12 oct.');
    expect(rows[1]).toHaveTextContent('78 kg');
    expect(screen.getByRole('button', { name: 'Masquer le tableau' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Masquer le tableau' }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('étiquette personnalisée d’un point (semaine, mois)', () => {
    chart([{ date: '2026-10-05', value: 80, label: 'Semaine du 5 oct. 2026' }]);
    expect(screen.getByText(/Semaine du 5 oct\. 2026/)).toBeInTheDocument();
  });

  it('plusieurs centaines de points : rendu rapide, un seul tracé, peu de cercles', () => {
    const points = Array.from({ length: 800 }, (_, i) => ({
      date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
      value: 80 + Math.sin(i / 10) * 3,
    }));
    const start = performance.now();
    const { container } = chart(points);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1500);
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(container.querySelectorAll('circle').length).toBeLessThanOrEqual(2);
  });

  it('valeurs toutes identiques : pas d’erreur', () => {
    const { container } = chart([point('2026-10-01', 80), point('2026-10-12', 80)]);
    expect(container.querySelector('path')?.getAttribute('d')).not.toContain('NaN');
  });
});
