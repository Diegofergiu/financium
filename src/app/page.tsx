'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { SplashScreen } from '@/components/brand/splash';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading) router.replace(user ? '/dashboard' : '/login');
  }, [user, isUserLoading, router]);

  return <SplashScreen />;
}
