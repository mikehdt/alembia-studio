'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

type ModalContextType = {
  portalRef: React.RefObject<HTMLDivElement | null>;
  /** Register that a modal has opened. Returns an unregister function. */
  registerOpen: () => () => void;
  /** Number of currently open modals. */
  openCount: number;
};

const ModalContext = createContext<ModalContextType | null>(null);

export const ModalProvider = ({ children }: { children: React.ReactNode }) => {
  const portalRef = useRef<HTMLDivElement>(null);
  const [openCount, setOpenCount] = useState(0);

  const registerOpen = useCallback(() => {
    setOpenCount((c) => c + 1);
    return () => setOpenCount((c) => Math.max(0, c - 1));
  }, []);

  return (
    <ModalContext.Provider value={{ portalRef, registerOpen, openCount }}>
      {children}
      {/* This div serves as the portal container for all modals */}
      <div id="modal-portal-container" ref={portalRef} />
    </ModalContext.Provider>
  );
};

export const useModalPortal = (): HTMLElement | null => {
  const context = useContext(ModalContext);

  // For client-side rendering, use the portal container if available
  if (typeof document !== 'undefined') {
    // If the portal container exists from the provider, use it
    if (context?.portalRef.current) {
      return context.portalRef.current;
    }

    // Fallback: check if portal element exists in the DOM
    const existingPortal = document.getElementById('modal-portal-container');
    if (existingPortal) {
      return existingPortal;
    }

    // Last resort: create a portal container and append it to the body
    const newPortalContainer = document.createElement('div');
    newPortalContainer.id = 'modal-portal-container';
    document.body.appendChild(newPortalContainer);
    return newPortalContainer;
  }

  // For SSR - return null until client-side rendering takes over
  return null;
};

/** Hook to register a modal as open. Call in an effect keyed on isOpen. */
export const useModalRegister = (): ((isOpen: boolean) => void) => {
  const context = useContext(ModalContext);
  const unregisterRef = useRef<(() => void) | null>(null);

  return useCallback(
    (isOpen: boolean) => {
      if (!context) return;
      if (isOpen && !unregisterRef.current) {
        unregisterRef.current = context.registerOpen();
      } else if (!isOpen && unregisterRef.current) {
        unregisterRef.current();
        unregisterRef.current = null;
      }
    },
    [context],
  );
};

/** Whether any modal is currently open. */
export const useIsAnyModalOpen = (): boolean => {
  const context = useContext(ModalContext);
  return (context?.openCount ?? 0) > 0;
};
