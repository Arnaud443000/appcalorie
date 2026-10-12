import { createContext, useContext } from 'react';

export interface ToastApi {
  /** Affiche un message court en bas de l'écran pendant quelques secondes. */
  show: (message: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast doit être utilisé dans <ToastProvider>.');
  return api;
}
