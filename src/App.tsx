import { useState } from 'react'
import './App.css'
import logo from './assets/logo.svg'
import { BorderTool } from './components/BorderTool'
import { ContactSheetTool } from './components/ContactSheetTool'

type AppMode = 'border' | 'sheet'

function App() {
  const [mode, setMode] = useState<AppMode>('border')

  return (
    <main className="app">
      <header>
        <h1>
          <img src={logo} alt="Border logo" className="logo" />
          Border
        </h1>
        <p>Everything runs locally in your browser</p>
      </header>

      <nav className="mode-tabs" aria-label="Choose a tool">
        <button
          type="button"
          className={`mode-tab ${mode === 'border' ? 'mode-tab--active' : ''}`}
          onClick={() => setMode('border')}
        >
          Border
        </button>
        <button
          type="button"
          className={`mode-tab ${mode === 'sheet' ? 'mode-tab--active' : ''}`}
          onClick={() => setMode('sheet')}
        >
          Contact sheet
        </button>
      </nav>

      <BorderTool hidden={mode !== 'border'} />
      <ContactSheetTool hidden={mode !== 'sheet'} />
    </main>
  )
}

export default App