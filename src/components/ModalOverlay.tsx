'use client';

import { ReactNode, useEffect } from 'react';

interface ModalOverlayProps {
  children: ReactNode;
  zClassName?: string;
}

// Mount only while the modal is open: the scroll lock is tied to this component's lifetime.
export default function ModalOverlay({ children, zClassName = 'z-50' }: ModalOverlayProps) {
  useEffect(() => {
    // Restore the previous value, not '': a nested modal closing must not unlock the one beneath it
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // The scroll container must not centre: items-center on it pushes a tall panel's top out of reach.
  // The inner wrapper centres instead, and min-h-full lets it grow past the viewport.
  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 overflow-y-auto ${zClassName}`}>
      <div className="flex min-h-full items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}
