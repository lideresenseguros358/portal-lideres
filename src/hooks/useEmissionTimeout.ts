/**
 * useEmissionTimeout
 * Starts a hidden 30-minute countdown when the emission flow mounts.
 * Calls `onTimeout` exactly once when the timer expires.
 * Cancels automatically if the component unmounts before expiry
 * (e.g. user completes the emission successfully).
 */

import { useEffect, useRef } from 'react';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function useEmissionTimeout(onTimeout: () => void): void {
  // Keep a ref to always call the latest version of the callback,
  // without resetting the timer when the function identity changes.
  const cbRef = useRef(onTimeout);
  cbRef.current = onTimeout;

  useEffect(() => {
    const timer = setTimeout(() => cbRef.current(), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []); // intentionally empty — timer starts once on mount
}
