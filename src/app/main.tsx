import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme } from '@/shared/theme';
import { GameScreen } from '@/ui/GameScreen';
import './global.css';

applyTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameScreen />
  </StrictMode>,
);
