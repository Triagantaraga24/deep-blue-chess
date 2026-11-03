import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/cinzel/latin-500.css';
import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-700.css';

import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/modals.css';

import { DEFAULT_SETTINGS } from './core/constants.js';
import { GameStore, loadSettings } from './core/storage.js';
import { EngineClient } from './engine/EngineClient.js';
import { SceneManager } from './scene/SceneManager.js';
import { Game } from './game/Game.js';
import { AppUI } from './ui/AppUI.js';

const settings = loadSettings(DEFAULT_SETTINGS);
const store = new GameStore();
const scene = new SceneManager(document.getElementById('scene-container'), settings);
const engine = new EngineClient('play');
const analysis = new EngineClient('analysis');
const game = new Game(engine, analysis, store, settings);
const ui = new AppUI({ game, scene, store, settings });

ui.init();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.dispose();
    scene.dispose();
  });
}
