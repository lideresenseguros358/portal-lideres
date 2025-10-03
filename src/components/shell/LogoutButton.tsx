'use client';

import { useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase/client';

import { ReactNode } from 'react';

interface LogoutButtonProps {
  onAfterLogout?: () => void;
  children?: ReactNode;
}

export default function LogoutButton({ onAfterLogout, children }: LogoutButtonProps = {}) {
  const router = useRouter();
  const supabase = supabaseClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onAfterLogout) {
      onAfterLogout();
    }
    router.push('/login');
  };

  return (
    <button onClick={handleLogout} className="dropdown-logout">
      {children ?? 'Cerrar sesión'}
    </button>
  );
}
