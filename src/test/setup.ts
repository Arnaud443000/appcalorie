import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom ne sait pas faire défiler la page (utilisé par ScrollRestoration).
window.scrollTo = () => {};
