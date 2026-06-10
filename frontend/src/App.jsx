import './App.css';
import MainLoop from './MainLoop';

function App() {
  const params = new URLSearchParams(window.location.search);
  const isSpatialEmbed = params.get('embed') === 'spatial' || window.location.pathname === '/embed';

  return (
    <div className={`App${isSpatialEmbed ? ' App--spatial-embed' : ''}`}>
      <header className="App-header">
        <MainLoop />
      </header>
    </div>
  );
}

export default App;
