import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// App entry point
import { AuthProvider } from './contexts/AuthProvider';
import { LoadingProvider } from './contexts/LoadingProvider';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LoadingProvider>
          <App />
        </LoadingProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
