import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { EntryIntro } from './EntryIntro';
import { isNative } from './lib/platform';
import './styles.css';
import './atmosphere.css';
import './collections.css';
import './mobile.css';
import './recommendations.css';
import './game-themes.css';
import './color-picker.css';
// Set the CSS layout gate before React paints the native window.
document.documentElement.toggleAttribute('data-native', isNative());
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><EntryIntro><App /></EntryIntro></React.StrictMode>);
