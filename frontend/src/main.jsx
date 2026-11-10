import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';

class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="fatal"><h1>Не удалось открыть мастерскую</h1><p>Разреши сохранение данных для этого сайта и обнови страницу.</p><button className="cta" onClick={() => location.reload()}>Обновить страницу</button></main>;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);
