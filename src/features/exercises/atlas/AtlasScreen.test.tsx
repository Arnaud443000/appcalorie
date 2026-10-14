import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedDemoData } from '@/data';
import { resetDb } from '@/test/fixtures';
import { AtlasScreen } from './AtlasScreen';
import { readAtlasPalette } from './palette';

// Le rendu WebGL réel ne se teste pas dans jsdom : le moteur Three.js et le chargement du
// modèle sont remplacés par des doublures qui enregistrent les appels.
const fake = vi.hoisted(() => {
  const state = {
    fail: false,
    loadFails: false,
    pick: null as { group: string; muscle: string } | null,
  };
  const instances: FakeEngine[] = [];
  class FakeEngine {
    options: { onStatus?: (status: { view: string | null; centered: boolean }) => void };
    palette: unknown;
    setHighlight = vi.fn();
    setModel = vi.fn();
    resize = vi.fn();
    setInsetTop = vi.fn();
    focusGroup = vi.fn();
    showView = vi.fn();
    recenter = vi.fn();
    rotateBy = vi.fn();
    panBy = vi.fn();
    zoomAt = vi.fn();
    zoomBy = vi.fn();
    dispose = vi.fn();
    pick = vi.fn(() => state.pick);
    constructor(_canvas: HTMLCanvasElement, palette: unknown, options: FakeEngine['options']) {
      if (state.fail) throw new Error('WebGL indisponible');
      this.palette = palette;
      this.options = options;
      instances.push(this);
    }
  }
  const loadModel = vi.fn(async (onProgress: (fraction: number) => void) => {
    onProgress(0.5);
    if (state.loadFails) throw new Error('hors ligne');
    return { groups: [], bytes: 0 };
  });
  return { state, instances, FakeEngine, loadModel };
});

vi.mock('./viewer/engine', () => ({ AtlasEngine: fake.FakeEngine }));
vi.mock('./loadModel', () => ({ loadModel: fake.loadModel }));

const BENCH = '0d1e1a00-0000-4000-8000-000000000001';

function renderAtlas(search = '') {
  const router = createMemoryRouter(
    [
      { path: '/exercices/atlas', element: <AtlasScreen /> },
      { path: '/exercices/:exerciseId', element: <p>Fiche</p> },
    ],
    { initialEntries: [`/exercices/atlas${search}`] },
  );
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

async function engine() {
  await waitFor(() => expect(fake.instances).toHaveLength(1));
  const [instance] = fake.instances;
  if (!instance) throw new Error('moteur absent');
  await waitFor(() => expect(instance.setModel).toHaveBeenCalled());
  return instance;
}

const sheetTitle = () => screen.getByRole('region').querySelector('h2')?.textContent;

describe('AtlasScreen', () => {
  beforeEach(async () => {
    await resetDb();
    await seedDemoData();
    fake.instances.length = 0;
    fake.loadModel.mockClear();
    Object.assign(fake.state, { fail: false, loadFails: false, pick: null });
    // WebGL « disponible » pour le test de détection (aucun rendu n'a lieu).
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({ getExtension: () => ({ loseContext() {} }) }) as never,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('?muscle= : groupe en rouge, accompagnateurs en rose, exercices liés à leur fiche', async () => {
    renderAtlas('?muscle=chest');
    const chips = within(screen.getByRole('group', { name: 'Groupes musculaires' }));
    expect(chips.getAllByRole('button')).toHaveLength(15);
    expect(chips.getByRole('button', { name: 'Pectoraux' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const instance = await engine();
    await waitFor(() =>
      expect(instance.setHighlight).toHaveBeenLastCalledWith({
        chest: 'primary',
        triceps: 'secondary',
        shoulders: 'secondary',
      }),
    );
    expect(instance.focusGroup).toHaveBeenCalledWith('chest', 'front');

    expect(await screen.findByText('1 exercice · 0 en secondaire')).toBeInTheDocument();
    expect(sheetTitle()).toBe('Pectoraux');
    fireEvent.click(screen.getByRole('button', { name: 'Voir' }));
    expect(screen.getByRole('link', { name: /Développé couché/ })).toHaveAttribute(
      'href',
      `/exercices/${BENCH}`,
    );
    expect(screen.getByText(/Souvent sollicités avec : Épaules, Triceps/)).toBeInTheDocument();
  });

  it('toucher un muscle sur le corps choisit tout son groupe, sans faire tourner la vue', async () => {
    const { router, container } = renderAtlas();
    const instance = await engine();
    expect(sheetTitle()).toBe('Choisis un muscle');

    fake.state.pick = { group: 'lats', muscle: 'Grand dorsal' };
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    const touch = { pointerId: 1, clientX: 50, clientY: 80, pointerType: 'touch', button: 0 };
    fireEvent.pointerDown(canvas, touch);
    fireEvent.pointerUp(canvas, touch);

    await waitFor(() => expect(router.state.location.search).toBe('?muscle=lats'));
    expect(instance.pick).toHaveBeenCalledWith(50, 80);
    expect(sheetTitle()).toBe('Dorsaux');
    expect(screen.getByText('Grand dorsal')).toBeInTheDocument();
    expect(instance.focusGroup).not.toHaveBeenCalled();
    expect(await screen.findByText('1 exercice · 0 en secondaire')).toBeInTheDocument();
  });

  it('les puces choisissent un groupe (et le corps se tourne), un second appui le retire', async () => {
    const { router } = renderAtlas();
    const instance = await engine();
    const mollets = screen.getByRole('button', { name: 'Mollets' });
    fireEvent.click(mollets);
    expect(router.state.location.search).toBe('?muscle=calves');
    await waitFor(() => expect(instance.focusGroup).toHaveBeenCalledWith('calves', 'back'));
    expect(mollets).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(mollets);
    expect(router.state.location.search).toBe('');
    expect(sheetTitle()).toBe('Choisis un muscle');
    await waitFor(() => expect(instance.setHighlight).toHaveBeenLastCalledWith({}));
  });

  it('?exercice= : muscles principaux en rouge, secondaires en rose, nom affiché', async () => {
    renderAtlas(`?exercice=${BENCH}`);
    const instance = await engine();
    await waitFor(() =>
      expect(instance.setHighlight).toHaveBeenLastCalledWith({
        chest: 'primary',
        triceps: 'secondary',
        shoulders: 'secondary',
      }),
    );
    expect(instance.focusGroup).toHaveBeenCalledWith('chest', 'front');
    expect(sheetTitle()).toBe('Développé couché');
    expect(screen.getAllByText('Développé couché')).toHaveLength(2); // légende + feuille
    expect(screen.getByText('Pectoraux + Épaules, Triceps')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voir' }));
    expect(screen.getByRole('link', { name: /Voir la fiche/ })).toHaveAttribute(
      'href',
      `/exercices/${BENCH}`,
    );
  });

  it('signale un exercice introuvable et un groupe sans exercice', async () => {
    const { router } = renderAtlas('?exercice=inconnu');
    expect(await screen.findByText('Exercice introuvable')).toBeInTheDocument();
    await act(() => router.navigate('/exercices/atlas?muscle=neck'));
    expect(await screen.findByText('Aucun exercice pour l’instant')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voir' }));
    expect(screen.getByText('Aucun exercice')).toBeInTheDocument();
  });

  it('boutons Face · Dos · Gauche · Droite et Recentrer', async () => {
    renderAtlas();
    const instance = await engine();
    fireEvent.click(screen.getByRole('button', { name: 'Vue de dos' }));
    expect(instance.showView).toHaveBeenCalledWith('back');
    act(() => instance.options.onStatus?.({ view: 'back', centered: false }));
    expect(screen.getByRole('button', { name: 'Vue de dos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Recentrer' }));
    expect(instance.recenter).toHaveBeenCalled();
  });

  it('libère la scène en quittant l’écran', async () => {
    const { unmount } = renderAtlas();
    const instance = await engine();
    unmount();
    expect(instance.dispose).toHaveBeenCalledTimes(1);
  });

  it('sans WebGL : message clair, Three.js jamais chargé, les puces restent utilisables', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    const { router } = renderAtlas();
    expect(screen.getByRole('alert')).toHaveTextContent('3D indisponible');
    fireEvent.click(screen.getByRole('button', { name: 'Biceps' }));
    expect(router.state.location.search).toBe('?muscle=biceps');
    // Curl haltères en principal, Tractions en secondaire.
    expect(await screen.findByText('1 exercice · 1 en secondaire')).toBeInTheDocument();
    expect(fake.instances).toHaveLength(0);
    expect(fake.loadModel).not.toHaveBeenCalled();
  });

  it('si la création du contexte WebGL échoue : message clair', async () => {
    fake.state.fail = true;
    renderAtlas();
    expect(await screen.findByRole('alert')).toHaveTextContent('3D indisponible');
  });

  it('si le modèle ne se télécharge pas : message et bouton Réessayer', async () => {
    fake.state.loadFails = true;
    renderAtlas();
    expect(await screen.findByRole('alert')).toHaveTextContent('Modèle non chargé');
    fake.state.loadFails = false;
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(fake.loadModel).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(fake.instances[0]?.dispose).toHaveBeenCalled();
  });
});

describe('Couleurs de la scène', () => {
  it('sont lues dans les variables CSS', () => {
    const element = document.createElement('div');
    document.body.append(element);
    element.style.setProperty('--color-accent', 'tomato');
    element.style.setProperty('--color-accent-2', 'pink');
    element.style.setProperty('--color-text', 'white');
    const palette = readAtlasPalette(element);
    expect(palette).toMatchObject({ primary: 'tomato', secondary: 'pink', muscle: 'white' });
    element.remove();
  });
});
