import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { bootstrapStorage, isStorageReady } from '@/lib/storage';

export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [storageReady, setStorageReady] = useState(isStorageReady());

  useEffect(() => {
    if (!session) return;
    if (isStorageReady()) { setStorageReady(true); return; }
    bootstrapStorage().then(() => setStorageReady(true));
  }, [session]);

  if (loading) {
    return <div className="h-screen grid place-items-center text-[13px] text-mute-2">Carregando…</div>;
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!storageReady) {
    return <div className="h-screen grid place-items-center text-[13px] text-mute-2">Sincronizando dados…</div>;
  }
  return <Outlet />;
}
