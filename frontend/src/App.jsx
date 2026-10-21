import { useState } from 'react';

export default function App() {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  async function fetchGreeting() {
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/', {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (typeof data.message !== 'string') {
        throw new Error('Invalid response');
      }

      setMessage(data.message);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  return (
    <main>
      <h1>Hello World</h1>
      <p>Vite + React の開発環境へようこそ。</p>
      <section aria-labelledby="api-heading">
        <h2 id="api-heading">API接続確認</h2>
        <button onClick={fetchGreeting} disabled={status === 'loading'}>
          {status === 'loading' ? '取得中…' : 'APIからメッセージを取得'}
        </button>
        <div role="status" aria-live="polite">
          {status === 'idle' && <p>ボタンを押すとAPIの応答を表示します。</p>}
          {status === 'loading' && <p>APIに接続しています…</p>}
          {status === 'success' && <p>APIの応答：<strong>{message}</strong></p>}
        </div>
        {status === 'error' && (
          <p role="alert" className="error">
            APIに接続できませんでした。バックエンドの起動を確認して、もう一度お試しください。
          </p>
        )}
      </section>
    </main>
  );
}
