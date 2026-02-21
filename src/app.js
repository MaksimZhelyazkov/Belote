import { GameEngine } from './engine/GameEngine.js';
import { AIEngine } from './engine/AIEngine.js';
import { GameInterface } from './ui/GameInterface.js';

document.addEventListener('DOMContentLoaded', () => {
    let ui; // Declare outside to make available to callbacks

    // 1. Initialize logic
    const engine = new GameEngine({
        onStateChange: (state) => {
            // Give AI a chance to think
            ai.processTurn();
            // Render UI
            ui.render(state);
        },
        onTutorialEvent: (event) => {
            ui.showTutorial(event.title, event.message);
        }
    });

    // 2. Initialize AI
    const ai = new AIEngine(engine);

    // 3. Initialize UI
    ui = new GameInterface(engine);

    // Initial render
    ui.render();
});
