// Safe access to electronAPI with proper error handling
export const getElectronAPI = () => {
  // Debug logging
  console.log('Checking electronAPI...');
  console.log('typeof window:', typeof window);
  
  if (typeof window === 'undefined') {
    throw new Error('Window is undefined - not in browser environment');
  }
  
  console.log('window.electronAPI:', window.electronAPI);
  console.log('window keys:', Object.keys(window).filter(k => k.includes('electron')));
  
  if (window.electronAPI) {
    return window.electronAPI;
  }
  
  throw new Error(
    'electronAPI is not available. This could mean:\n' +
    '1. The app is not running in Electron\n' +
    '2. The preload script failed to load\n' +
    '3. There was an error initializing the Electron context'
  );
};

// Check if electronAPI is available
export const isElectronAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!window.electronAPI;
};

// Wait for electronAPI to be available
export const waitForElectronAPI = (timeout = 5000): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (isElectronAvailable()) {
        resolve(true);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for electronAPI'));
        return;
      }
      
      setTimeout(check, 100);
    };
    
    check();
  });
};
