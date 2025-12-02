import React, { createContext, useEffect, useState } from 'react';
import { getLogger } from '../core';

const log = getLogger('NetworkProvider');

export interface NetworkState {
  isOnline: boolean;
}

const initialState: NetworkState = {
  isOnline: navigator.onLine,
};

export const NetworkContext = createContext<NetworkState>(initialState);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      log('Network: ONLINE');
      setIsOnline(true);
    };

    const handleOffline = () => {
      log('Network: OFFLINE');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const value = { isOnline };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};