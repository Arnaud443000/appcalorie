import { Outlet, ScrollRestoration } from 'react-router';
import { ToastProvider } from '@/ui';
import { TabBar } from './TabBar';

export function AppLayout() {
  return (
    <ToastProvider>
      <Outlet />
      <TabBar />
      <ScrollRestoration />
    </ToastProvider>
  );
}
