import React from 'react';
import { createRoot } from 'react-dom/client';

const App = () => {
  const [count, setCount] = React.useState(0);

  return (
    <div className="app">
      <h1>Welcome to Verb + React!</h1>
      <p>This is a fullstack example with HTML imports.</p>
      <div className="counter">
        <button onClick={() => setCount(count - 1)}>-</button>
        <span>{count}</span>
        <button onClick={() => setCount(count + 1)}>+</button>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);