import { SUIT_SYMBOLS, getValidMoves } from '../engine/CardLogic.js';
import { PHASES } from '../engine/GameEngine.js';

export class GameInterface {
    constructor(gameEngine) {
        this.game = gameEngine;
        this.elements = {
            hands: [
                document.getElementById('hand-bottom'), // 0: You
                document.getElementById('hand-left'),   // 1: West
                document.getElementById('hand-top'),    // 2: Partner
                document.getElementById('hand-right')   // 3: East
            ],
            trickArea: document.getElementById('trick-area'),
            biddingArea: document.getElementById('center-bidding-area'),
            biddingStatus: document.getElementById('bidding-status'),
            turnUpContainer: document.getElementById('turn-up-card-container'),
            biddingControls: document.getElementById('bidding-controls'),
            suitSelection: document.getElementById('suit-selection'),

            scoreNS: document.getElementById('score-ns'),
            scoreEW: document.getElementById('score-ew'),
            currentTrump: document.getElementById('current-trump'),
            currentPhase: document.getElementById('current-phase'),

            tutorialOverlay: document.getElementById('tutorial-overlay'),
            tutorialMessage: document.getElementById('tutorial-message'),

            btnTake: document.getElementById('btn-take'),
            btnPass: document.getElementById('btn-pass'),
            btnTutorialOk: document.getElementById('btn-tutorial-ok'),
            btnStart: document.getElementById('btn-start-game'),
            toggleTutorial: document.getElementById('tutorial-toggle'),

            playerAreas: [
                document.getElementById('player-bottom'),
                document.getElementById('player-left'),
                document.getElementById('player-top'),
                document.getElementById('player-right')
            ]
        };

        this.bindEvents();
    }

    bindEvents() {
        this.elements.btnStart.addEventListener('click', () => {
            this.elements.btnStart.classList.add('hidden');
            this.game.startNewGame();
        });

        this.elements.btnTake.addEventListener('click', () => {
            if (this.game.phase === PHASES.BIDDING_R1) {
                this.game.makeBid(0, this.game.turnUpCard.suit);
            } else if (this.game.phase === PHASES.BIDDING_R2) {
                // Show suit selection
                this.elements.suitSelection.classList.remove('hidden');
                this.elements.btnTake.classList.add('hidden');
                this.elements.btnPass.classList.add('hidden');
            }
        });

        this.elements.btnPass.addEventListener('click', () => {
            this.game.makeBid(0, null);
        });

        document.querySelectorAll('.btn-suit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const suit = e.target.getAttribute('data-suit');
                if (suit === this.game.turnUpCard.suit) return; // Cant choose turned up suit in R2
                this.game.makeBid(0, suit);
            });
        });

        this.elements.btnTutorialOk.addEventListener('click', () => {
            this.elements.tutorialOverlay.classList.add('hidden');
        });

        this.elements.toggleTutorial.addEventListener('change', (e) => {
            this.game.tutorialEnabled = e.target.checked;
            this.render(); // Re-render to show/hide point overlays
        });

        // Event delegation for card clicks
        this.elements.hands[0].addEventListener('click', (e) => {
            const cardEl = e.target.closest('.card.playable');
            if (!cardEl) return;

            const suit = cardEl.getAttribute('data-suit');
            const rank = cardEl.getAttribute('data-rank');

            if (suit && rank) {
                this.game.playCard(0, { suit, rank });
            }
        });
    }

    renderCard(card, isFaceUp = true, isValid = true, points = null) {
        const div = document.createElement('div');
        div.className = `card \${isFaceUp && card.isRed() ? 'red' : 'black'}`;

        if (!isFaceUp) {
            div.style.background = 'radial-gradient(circle at 50% 50%, #1e293b, #0f172a)';
            div.style.border = '2px solid rgba(255,255,255,0.1)';
            return div;
        }

        const symbol = SUIT_SYMBOLS[card.suit];
        div.setAttribute('data-suit', card.suit);
        div.setAttribute('data-rank', card.rank);

        div.innerHTML = `
            <div class="card-top">
                <span>\${card.rank}</span>
                <span>\${symbol}</span>
            </div>
            <div class="card-center">\${symbol}</div>
            <div class="card-bottom">
                <span>\${card.rank}</span>
                <span>\${symbol}</span>
            </div>
        `;

        // Add tutorial points if enabled
        if (this.game.tutorialEnabled && points !== null) {
            const ptsDiv = document.createElement('div');
            ptsDiv.className = 'point-overlay';
            ptsDiv.innerText = `\${points} pts`;
            div.appendChild(ptsDiv);
        }

        if (isValid) {
            div.classList.add('playable');
        } else {
            div.classList.add('not-playable');
        }

        return div;
    }

    showTutorial(title, message) {
        this.elements.tutorialOverlay.querySelector('.modal-header h2').innerText = `🎓 \${title}`;
        this.elements.tutorialMessage.innerText = message;
        this.elements.tutorialOverlay.classList.remove('hidden');
    }

    render(state = null) {
        if (!state) state = this.game.getState();

        // General Updates
        this.elements.scoreNS.innerText = state.scores.NS;
        this.elements.scoreEW.innerText = state.scores.EW;
        this.elements.currentTrump.innerText = `Trump: \${state.currentTrump ? SUIT_SYMBOLS[state.currentTrump] : '-'}`;
        this.elements.currentPhase.innerText = `Phase: \${state.phase.toUpperCase()}`;

        // Active Player Highlighting
        this.elements.playerAreas.forEach((area, idx) => {
            if (idx === state.currentPlayer) {
                area.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.4)';
            } else {
                area.style.boxShadow = 'none';
            }
        });

        // Render Truthy Game Phase
        if (state.phase === PHASES.DEALING) {
            this.clearTable();
        } else if (state.phase.startsWith('bidding')) {
            this.renderBidding(state);
            this.renderHands(state);
        } else if (state.phase === PHASES.PLAYING) {
            this.elements.biddingArea.classList.add('hidden');
            this.renderHands(state);
            this.renderTrick(state);
        } else if (state.phase === PHASES.SCORING || state.phase === PHASES.GAME_OVER) {
            this.clearTable();
            this.elements.biddingStatus.innerText = state.phase === PHASES.GAME_OVER ? "Game Over! Thanks for playing." : "Round complete!";
            this.elements.biddingArea.classList.remove('hidden');
            this.elements.biddingControls.classList.add('hidden');
            this.elements.turnUpContainer.innerHTML = '';
        }
    }

    clearTable() {
        this.elements.trickArea.innerHTML = '';
        this.elements.turnUpContainer.innerHTML = '';
        this.elements.biddingArea.classList.add('hidden');
        this.elements.biddingControls.classList.add('hidden');
        this.elements.suitSelection.classList.add('hidden');
    }

    renderBidding(state) {
        this.elements.biddingArea.classList.remove('hidden');
        this.elements.turnUpContainer.innerHTML = '';

        if (state.turnUpCard) {
            const cardEl = this.renderCard(state.turnUpCard, true, false, null);
            this.elements.turnUpContainer.appendChild(cardEl);
        }

        if (state.currentPlayer === 0) {
            this.elements.biddingStatus.innerText = `Your turn to bid (Round \${state.phase === PHASES.BIDDING_R1 ? '1' : '2'})`;
            this.elements.biddingControls.classList.remove('hidden');
            this.elements.suitSelection.classList.add('hidden');
            this.elements.btnTake.classList.remove('hidden');
            this.elements.btnPass.classList.remove('hidden');
        } else {
            this.elements.biddingStatus.innerText = `Waiting for Player \${state.currentPlayer}...`;
            this.elements.biddingControls.classList.add('hidden');
        }
    }

    renderHands(state) {
        // Evaluate valid moves for human player if it's playing phase
        let validCards = [];
        if (state.phase === PHASES.PLAYING && state.currentPlayer === 0) {
            const validation = getValidMoves(state.players[0], state.currentTrick, state.currentTrump);
            validCards = validation.validCards;
        }

        state.players.forEach((hand, playerIndex) => {
            const handContainer = this.elements.hands[playerIndex];
            handContainer.innerHTML = '';

            hand.forEach(card => {
                if (playerIndex === 0) {
                    // Human player sees cards
                    const isPlayable = state.phase === PHASES.PLAYING && state.currentPlayer === 0 &&
                        validCards.some(c => c.suit === card.suit && c.rank === card.rank);

                    // Show points if tutorial enabled
                    const pts = card.getPoints(state.currentTrump);
                    const cardEl = this.renderCard(card, true, isPlayable, pts);
                    handContainer.appendChild(cardEl);
                } else {
                    // Bots see face down
                    const cardEl = this.renderCard(card, false);
                    handContainer.appendChild(cardEl);
                }
            });
        });
    }

    renderTrick(state) {
        this.elements.trickArea.innerHTML = '';
        const positions = ['bottom', 'left', 'top', 'right']; // Relative to human (0)

        state.currentTrick.forEach(turn => {
            const pos = positions[turn.playerIndex];
            const cardEl = this.renderCard(turn.card, true, false, null);
            cardEl.classList.add('played-card', pos);
            // Slight rotation for visual flair
            cardEl.style.transform += ` rotate(\${(Math.random() - 0.5) * 15}deg)`;
            this.elements.trickArea.appendChild(cardEl);
        });
    }
}
