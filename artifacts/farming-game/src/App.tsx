import { useState, useEffect } from 'react';
import FarmingGame from './pages/FarmingGame';

function App() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hide loading after a short delay to show something
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Global error handler
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      setError(event.error?.message || 'An error occurred');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      setError(event.reason?.message || 'A promise rejection occurred');
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (error) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a1a',
        color: '#fff',
        fontFamily: 'monospace',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#ff4444', marginBottom: '20px' }}>Error Loading Game</h2>
        <p style={{ marginBottom: '20px', maxWidth: '600px' }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Reload Game
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: '#fff',
        fontFamily: '"Press Start 2P", monospace'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '20px' }}>LIFETOPIA</div>
        <div style={{ fontSize: '12px', color: '#888' }}>Loading...</div>
      </div>
    );
  }

  return <FarmingGame />;
}

export default App;
