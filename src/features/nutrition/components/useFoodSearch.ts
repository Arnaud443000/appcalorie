import { useEffect, useRef, useState } from 'react';
import { searchFoods, type SearchOutcome } from '../foods';

const MIN_LENGTH = 2;
const TYPING_DELAY_MS = 200;

export interface FoodSearch {
  query: string;
  setQuery: (query: string) => void;
  /** Résultats de la dernière recherche (`null` tant que la recherche est trop courte). */
  outcome: SearchOutcome | null;
  /** Recherche en ligne en cours (Open Food Facts). */
  loading: boolean;
  /** Vrai si la recherche est assez longue pour être lancée. */
  canSearch: boolean;
  /** Lance la recherche complète, avec Open Food Facts (touche Entrée / bouton). */
  searchOnline: () => Promise<void>;
}

/**
 * Recherche d'aliments : pendant la frappe, seulement mes aliments + CIQUAL (rien n'est envoyé sur le
 * réseau) ; Open Food Facts n'est interrogé qu'à la validation (limite de débit de leur service).
 */
export function useFoodSearch(): FoodSearch {
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [loading, setLoading] = useState(false);
  // Numéro de la dernière recherche lancée : une réponse en retard est ignorée.
  const latest = useRef(0);
  const canSearch = query.trim().length >= MIN_LENGTH;

  useEffect(() => {
    const id = ++latest.current;
    const timer = setTimeout(() => {
      if (!canSearch) {
        setOutcome(null);
        setLoading(false);
        return;
      }
      void searchFoods(query, { remote: false }).then((result) => {
        if (latest.current === id) {
          setOutcome(result);
          setLoading(false);
        }
      });
    }, TYPING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, canSearch]);

  async function searchOnline() {
    if (!canSearch) return;
    const id = ++latest.current;
    setLoading(true);
    const result = await searchFoods(query, { remote: true });
    if (latest.current === id) {
      setOutcome(result);
      setLoading(false);
    }
  }

  return { query, setQuery, outcome, loading, canSearch, searchOnline };
}
