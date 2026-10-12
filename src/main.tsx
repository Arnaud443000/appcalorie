import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { createAppRouter } from './app/router';
import { prepareData } from './app/startup';
import './ui/global.css';

// Demande au navigateur de ne pas effacer les données locales en cas de manque de place.
void navigator.storage?.persist?.();
// Les écrans se mettent à jour d'eux-mêmes quand les données arrivent (useLiveQuery).
void prepareData();

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable.');

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={createAppRouter()} />
  </StrictMode>,
);
