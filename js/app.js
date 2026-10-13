import * as L from './logic.js';
import { loadState, saveStateDebounced, nowIso, newId } from './store.js';

const App = { view: 'home', catId: null, sheet: null, state: null };

function ctx() { return { now: nowIso(), id: newId() }; }
function commit(next) { App.state = next; saveStateDebounced(App.state); render(); }

function render() {
  const root = document.getElementById('app');
  root.innerHTML = '<div class="banner"><div class="b">🐼 PandaCoins</div>'
    + '<div class="status">laster…</div></div>';
}

App.state = loadState();
render();
window.App = App; // for feilsøking i konsollen
