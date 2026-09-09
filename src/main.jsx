import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import InstallPrompt from './mobile/InstallPrompt.jsx';
import { initNative } from './lib/native';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <InstallPrompt />
  </StrictMode>,
);

// Configure the native shell (status bar, back button) and hide the splash.
initNative();
