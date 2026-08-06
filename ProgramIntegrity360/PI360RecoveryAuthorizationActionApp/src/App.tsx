import { useCallback, useEffect, useState } from 'react';
import Form from './components/Form';
import './App.css';

function App() {
  const [darkTheme, setDarkTheme] = useState(false);

  const handleInitTheme = useCallback((isDark: boolean) => {
    setDarkTheme(isDark);
  }, []);

  const toggleTheme = useCallback(() => setDarkTheme((current) => !current), []);

  useEffect(() => {
    document.body.className = darkTheme ? 'dark' : 'light';
  }, [darkTheme]);

  return (
    <div className={`app-shell ${darkTheme ? 'dark' : 'light'}`}>
      <Form onInitTheme={handleInitTheme} darkTheme={darkTheme} onToggleTheme={toggleTheme} />
    </div>
  );
}

export default App;
