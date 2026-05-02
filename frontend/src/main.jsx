import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Bootstrap (used for responsive grid + utility classes — see project requirements).
import 'bootstrap/dist/css/bootstrap.min.css';

// Tailwind / app styles - imported after Bootstrap so utility classes win on conflicts.
import './styles/index.css';
import './styles/app.css';

import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
