import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { EntryIntro } from './EntryIntro';
import './styles.css';
import './atmosphere.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><EntryIntro><App /></EntryIntro></React.StrictMode>);
