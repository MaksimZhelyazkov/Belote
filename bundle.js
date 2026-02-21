// --- CardLogic.js ---
const SUITS = { HEARTS: 'hearts', DIAMONDS: 'diamonds', CLUBS: 'clubs', SPADES: 'spades' };
const SUIT_SYMBOLS = { [SUITS.HEARTS]: '♥️', [SUITS.DIAMONDS]: '♦️', [SUITS.CLUBS]: '♣️', [SUITS.SPADES]: '♠️' };
const RANKS = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
const POINTS_NORMAL = { '7': 0, '8': 0, '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 11 };
const POINTS_TRUMP = { '7': 0, '8': 0, 'Q': 3, 'K': 4, '10': 10, 'A': 11, '9': 14, 'J': 20 };
const HIERARCHY_NORMAL = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
const HIERARCHY_TRUMP = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J'];

class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
    }
    getPoints(trumpSuit) { return this.suit === trumpSuit ? POINTS_TRUMP[this.rank] : POINTS_NORMAL[this.rank]; }
    getPower(trumpSuit, leadSuit) {
        if (this.suit === trumpSuit) return 200 + HIERARCHY_TRUMP.indexOf(this.rank);
        if (this.suit === leadSuit) return 100 + HIERARCHY_NORMAL.indexOf(this.rank);
        return HIERARCHY_NORMAL.indexOf(this.rank);
    }
    isRed() { return this.suit === SUITS.HEARTS || this.suit === SUITS.DIAMONDS; }
}

function generateDeck() {
    const deck = [];
    for (const suit of Object.values(SUITS)) {
        for (const rank of RANKS) deck.push(new Card(suit, rank));
    }
    return deck;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function getValidMoves(hand, currentTrick, trumpSuit) {
    if (currentTrick.length === 0) return { validCards: [...hand], reason: "You are leading the trick. You can play any card." };
    const leadSuit = currentTrick[0].card.suit;
    const cardsOfLeadSuit = hand.filter(c => c.suit === leadSuit);
    const trumpCards = hand.filter(c => c.suit === trumpSuit);

    if (cardsOfLeadSuit.length > 0) {
        if (leadSuit === trumpSuit) {
            let highestTrumpInTrickPower = -1;
            for (const turn of currentTrick) {
                if (turn.card.suit === trumpSuit) highestTrumpInTrickPower = Math.max(highestTrumpInTrickPower, turn.card.getPower(trumpSuit, leadSuit));
            }
            const higherTrumps = cardsOfLeadSuit.filter(c => c.getPower(trumpSuit, leadSuit) > highestTrumpInTrickPower);
            if (higherTrumps.length > 0) return { validCards: higherTrumps, reason: "When trumps are led, you must follow suit and overtrump if you can." };
            else return { validCards: cardsOfLeadSuit, reason: "You must follow suit (trump). You cannot overtrump, so any trump is valid." };
        }
        return { validCards: cardsOfLeadSuit, reason: `You must follow the lead suit (${leadSuit}).` };
    }

    if (trumpCards.length > 0) {
        const enemyTrumps = currentTrick.filter((turn, idx) => turn.card.suit === trumpSuit && (currentTrick.length - idx) % 2 !== 0);
        if (enemyTrumps.length > 0) {
            let highestEnemyTrump = Math.max(...enemyTrumps.map(t => t.card.getPower(trumpSuit, leadSuit)));
            const higherTrumps = trumpCards.filter(c => c.getPower(trumpSuit, leadSuit) > highestEnemyTrump);
            if (higherTrumps.length > 0) return { validCards: higherTrumps, reason: "You cannot follow suit. You must overtrump the opponent." };
            return { validCards: trumpCards, reason: "You cannot follow suit, and you cannot overtrump the opponent, but you must play a trump." };
        }
        return { validCards: trumpCards, reason: "You cannot follow suit, so you must play a trump card." };
    }
    return { validCards: [...hand], reason: "You cannot follow suit and have no trumps. You can discard any card." };
}

function calculateTrickPoints(trick, trumpSuit) {
    return trick.reduce((sum, turn) => sum + turn.card.getPoints(trumpSuit), 0);
}


// --- GameEngine.js ---
const PHASES = {
    DEALING: 'dealing', BIDDING_R1: 'bidding-r1', BIDDING_R2: 'bidding-r2',
    PLAYING: 'playing', SCORING: 'scoring', GAME_OVER: 'game-over'
};

class GameEngine {
    constructor(uiCallbacks = {}) {
        this.players = [[], [], [], []];
        this.scores = { NS: 0, EW: 0 };
        this.dealer = 3;
        this.currentTrump = null;
        this.turnUpCard = null;
        this.currentTrick = [];
        this.tricksWon = { NS: 0, EW: 0 };
        this.phase = PHASES.DEALING;
        this.currentPlayer = 0;
        this.taker = null;
        this.onStateChange = uiCallbacks.onStateChange || (() => { });
        this.onTutorialEvent = uiCallbacks.onTutorialEvent || (() => { });
        this.tutorialEnabled = true;
    }

    startNewGame() {
        this.scores = { NS: 0, EW: 0 };
        this.startNewRound();
    }

    startNewRound() {
        this.deck = shuffleDeck(generateDeck());
        this.players = [[], [], [], []];
        this.tricksWon = { NS: 0, EW: 0 };
        this.currentTrick = [];
        this.currentTrump = null;
        this.turnUpCard = null;
        this.taker = null;
        this.playedCards = [];
        this.dealer = (this.dealer + 1) % 4;
        this.phase = PHASES.DEALING;
        this.notifyState();
        this.dealInitialCards();
    }

    dealInitialCards() {
        let cardIndex = 0;
        let p = (this.dealer + 1) % 4;
        for (let i = 0; i < 4; i++) {
            this.players[p].push(...this.deck.slice(cardIndex, cardIndex + 3));
            cardIndex += 3;
            p = (p + 1) % 4;
        }
        for (let i = 0; i < 4; i++) {
            this.players[p].push(...this.deck.slice(cardIndex, cardIndex + 2));
            cardIndex += 2;
            p = (p + 1) % 4;
        }
        this.turnUpCard = this.deck[cardIndex++];
        this.deckIndex = cardIndex;
        this.phase = PHASES.BIDDING_R1;
        this.currentPlayer = (this.dealer + 1) % 4;
        this.notifyState();
    }

    makeBid(playerIndex, suit = null) {
        if (playerIndex !== this.currentPlayer) return;

        if (suit !== null) {
            this.taker = playerIndex;
            this.currentTrump = suit;
            this.players[this.taker].push(this.turnUpCard);
            let p = (this.dealer + 1) % 4;
            for (let i = 0; i < 4; i++) {
                if (p === this.taker) {
                    this.players[p].push(...this.deck.slice(this.deckIndex, this.deckIndex + 2));
                    this.deckIndex += 2;
                } else {
                    this.players[p].push(...this.deck.slice(this.deckIndex, this.deckIndex + 3));
                    this.deckIndex += 3;
                }
                p = (p + 1) % 4;
            }
            this.phase = PHASES.PLAYING;
            this.currentPlayer = (this.dealer + 1) % 4;
            this.notifyState();
            return;
        }

        this.currentPlayer = (this.currentPlayer + 1) % 4;
        if (this.currentPlayer === (this.dealer + 1) % 4) {
            if (this.phase === PHASES.BIDDING_R1) this.phase = PHASES.BIDDING_R2;
            else { this.startNewRound(); return; }
        }
        this.notifyState();
    }

    playCard(playerIndex, card) {
        if (this.phase !== PHASES.PLAYING || playerIndex !== this.currentPlayer) return;
        const hand = this.players[playerIndex];
        const validation = getValidMoves(hand, this.currentTrick, this.currentTrump);
        const isValid = validation.validCards.some(c => c.suit === card.suit && c.rank === card.rank);

        if (!isValid) {
            if (this.tutorialEnabled && playerIndex === 0) {
                this.onTutorialEvent({ message: validation.reason, title: "Invalid Move" });
            }
            return false;
        }

        const cIndex = hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
        const playedCard = hand[cIndex];
        hand.splice(cIndex, 1);
        this.currentTrick.push({ playerIndex, card: playedCard });
        this.playedCards.push(playedCard);

        if (this.currentTrick.length === 4) {
            this.currentPlayer = null;
            this.notifyState();
            setTimeout(() => this.resolveTrick(), 2000);
        } else {
            this.currentPlayer = (this.currentPlayer + 1) % 4;
            this.notifyState();
        }
        return true;
    }

    resolveTrick() {
        const winnerObj = this.currentTrick.reduce((winner, current) => {
            const leadSuit = this.currentTrick[0].card.suit;
            const currentPower = current.card.getPower(this.currentTrump, leadSuit);
            const winnerPower = winner.card.getPower(this.currentTrump, leadSuit);
            return currentPower > winnerPower ? current : winner;
        });

        const winnerIndex = winnerObj.playerIndex;
        const pts = calculateTrickPoints(this.currentTrick, this.currentTrump);
        const winningTeam = (winnerIndex % 2 === 0) ? 'NS' : 'EW';
        this.tricksWon[winningTeam] += pts;

        if (this.tutorialEnabled) {
            const wCard = winnerObj.card;
            const names = { 0: "You", 1: "AI West", 2: "AI North", 3: "AI East (Partner)" };
            this.onTutorialEvent({
                title: `${names[winnerIndex]} won the trick!`,
                message: `${names[winnerIndex]} won this trick with the ${wCard.rank} ${SUIT_SYMBOLS[wCard.suit]} and collected ${pts} points for their team.`
            });
        }

        if (this.players[0].length === 0) {
            this.tricksWon[winningTeam] += 10;
            this.phase = PHASES.SCORING;
            this.resolveRoundScore();
        } else {
            this.currentTrick = [];
            this.currentPlayer = winnerIndex;
            this.notifyState();
        }
    }

    resolveRoundScore() {
        const takerTeam = (this.taker % 2 === 0) ? 'NS' : 'EW';
        const defenderTeam = takerTeam === 'NS' ? 'EW' : 'NS';
        let takerScore = this.tricksWon[takerTeam];
        let defenderScore = this.tricksWon[defenderTeam];

        if (takerScore > defenderScore && takerScore >= 82) {
            this.scores.NS += this.tricksWon.NS;
            this.scores.EW += this.tricksWon.EW;
        } else {
            this.scores[defenderTeam] += 162;
            if (this.tutorialEnabled) {
                this.onTutorialEvent({ title: "Contract Failed", message: "The takers failed to score more points than the defenders! Defenders get all 162 points." });
            }
        }

        if (this.scores.NS >= 1000 || this.scores.EW >= 1000) {
            this.phase = PHASES.GAME_OVER;
        } else {
            // UI button will trigger startNewRound() now
        }
        this.notifyState();
    }

    notifyState() { this.onStateChange(this.getState()); }

    getState() {
        return {
            phase: this.phase, players: this.players, scores: this.scores,
            currentTrump: this.currentTrump, turnUpCard: this.turnUpCard,
            currentTrick: this.currentTrick, currentPlayer: this.currentPlayer,
            taker: this.taker, tutorialEnabled: this.tutorialEnabled,
            playedCards: this.playedCards || []
        };
    }
}


// --- AIEngine.js ---
class AIEngine {
    constructor(gameEngine) {
        this.game = gameEngine;
        this.thinkingTimes = { min: 800, max: 2000 };
        this.actionPending = false;
    }

    processTurn() {
        const state = this.game.getState();
        const pIndex = state.currentPlayer;

        // Return if nobody's turn or human's turn
        if (pIndex === null || pIndex === 0) return;

        if (!this.actionPending) {
            this.actionPending = true;
            if (state.phase === PHASES.BIDDING_R1 || state.phase === PHASES.BIDDING_R2) {
                this.scheduleAction(() => {
                    this.actionPending = false;
                    this.makeBiddingDecision(this.game.getState(), pIndex);
                });
            } else if (state.phase === PHASES.PLAYING) {
                this.scheduleAction(() => {
                    this.actionPending = false;
                    this.makePlayDecision(this.game.getState(), pIndex);
                });
            } else {
                this.actionPending = false;
            }
        }
    }

    scheduleAction(action) {
        const delay = Math.floor(Math.random() * (this.thinkingTimes.max - this.thinkingTimes.min)) + this.thinkingTimes.min;
        setTimeout(action, delay);
    }

    makeBiddingDecision(state, pIndex) {
        let bidSuit = null;
        const hand = state.players[pIndex];

        if (state.phase === PHASES.BIDDING_R1) {
            const proposed = state.turnUpCard.suit;
            const trumps = hand.filter(c => c.suit === proposed);
            const hasGoodTrump = trumps.some(c => c.rank === 'J' || c.rank === '9');
            if (trumps.length >= 2 && hasGoodTrump) bidSuit = proposed;
        } else {
            const proposedR1 = state.turnUpCard.suit;
            for (const suit of Object.values(SUITS)) {
                if (suit === proposedR1) continue;
                const trumps = hand.filter(c => c.suit === suit);
                const hasGoodTrump = trumps.some(c => c.rank === 'J' || c.rank === '9');
                if (trumps.length >= 3 && hasGoodTrump) {
                    bidSuit = suit; break;
                }
            }
        }
        this.game.makeBid(pIndex, bidSuit);
    }

    makePlayDecision(state, pIndex) {
        const hand = state.players[pIndex];
        const validation = getValidMoves(hand, state.currentTrick, state.currentTrump);
        const validCards = validation.validCards;
        if (validCards.length === 0) return;

        let chosenCard = validCards[0];
        if (state.currentTrick.length > 0) {
            const leadSuit = state.currentTrick[0].card.suit;
            const winningCards = validCards.filter(c => {
                let isWinner = true;
                for (const t of state.currentTrick) {
                    if (t.card.getPower(state.currentTrump, leadSuit) >= c.getPower(state.currentTrump, leadSuit)) isWinner = false;
                }
                return isWinner;
            });

            if (winningCards.length > 0) {
                winningCards.sort((a, b) => a.getPower(state.currentTrump, leadSuit) - b.getPower(state.currentTrump, leadSuit));
                chosenCard = winningCards[0];
            } else {
                validCards.sort((a, b) => a.getPower(state.currentTrump, leadSuit) - b.getPower(state.currentTrump, leadSuit));
                chosenCard = validCards[0];
            }
        } else {
            chosenCard = validCards[Math.floor(Math.random() * validCards.length)];
        }
        this.game.playCard(pIndex, chosenCard);
    }
}


// --- GameInterface.js ---
class GameInterface {
    constructor(gameEngine) {
        this.game = gameEngine;
        this.elements = {
            hands: [
                document.getElementById('hand-bottom'), document.getElementById('hand-left'),
                document.getElementById('hand-top'), document.getElementById('hand-right')
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
            trackerContent: document.getElementById('tracker-content'),
            referenceGuide: document.getElementById('reference-guide'),
            tutorialOverlay: document.getElementById('tutorial-overlay'),
            tutorialMessage: document.getElementById('tutorial-message'),
            btnTake: document.getElementById('btn-take'),
            btnPass: document.getElementById('btn-pass'),
            btnNextRound: document.getElementById('btn-next-round'),
            btnTutorialOk: document.getElementById('btn-tutorial-ok'),
            btnStart: document.getElementById('btn-start-game'),
            toggleTutorial: document.getElementById('tutorial-toggle'),
            playerAreas: [
                document.getElementById('player-bottom'), document.getElementById('player-left'),
                document.getElementById('player-top'), document.getElementById('player-right')
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
                this.elements.suitSelection.classList.remove('hidden');
                this.elements.btnTake.classList.add('hidden');
                this.elements.btnPass.classList.add('hidden');
            }
        });

        this.elements.btnPass.addEventListener('click', () => {
            this.game.makeBid(0, null);
        });

        this.elements.btnNextRound.addEventListener('click', () => {
            this.elements.btnNextRound.classList.add('hidden');
            this.elements.biddingStatus.innerText = "Dealing...";
            this.game.startNewRound();
        });

        document.querySelectorAll('.btn-suit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const suit = e.target.getAttribute('data-suit');
                if (suit === this.game.turnUpCard.suit) return;
                this.game.makeBid(0, suit);
            });
        });

        this.elements.btnTutorialOk.addEventListener('click', () => {
            this.elements.tutorialOverlay.classList.add('hidden');
        });

        this.elements.toggleTutorial.addEventListener('change', (e) => {
            this.game.tutorialEnabled = e.target.checked;
            this.render();
        });

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
        div.className = 'card';

        const img = document.createElement('img');
        img.className = 'card-image';

        if (!isFaceUp) {
            img.src = 'assets/cards/back.png';
            div.appendChild(img);
            return div;
        }

        const suitMap = { 'hearts': 'H', 'diamonds': 'D', 'clubs': 'C', 'spades': 'S' };
        const rankStr = card.rank === '10' ? '0' : card.rank;
        img.src = `assets/cards/${rankStr}${suitMap[card.suit]}.png`;
        img.alt = `${card.rank} of ${card.suit}`;

        div.setAttribute('data-suit', card.suit);
        div.setAttribute('data-rank', card.rank);

        div.appendChild(img);

        if (this.game.tutorialEnabled && points !== null) {
            const ptsDiv = document.createElement('div');
            ptsDiv.className = 'point-overlay';
            ptsDiv.innerText = `${points} pts`;
            div.appendChild(ptsDiv);
        }

        if (isValid) div.classList.add('playable');
        else div.classList.add('not-playable');

        return div;
    }

    showTutorial(title, message) {
        this.elements.tutorialOverlay.querySelector('.modal-header h2').innerText = `🎓 ${title}`;
        this.elements.tutorialMessage.innerText = message;
        this.elements.tutorialOverlay.classList.remove('hidden');
    }

    render(state = null) {
        if (!state) state = this.game.getState();

        this.elements.scoreNS.innerText = state.scores.NS;
        this.elements.scoreEW.innerText = state.scores.EW;
        this.elements.currentTrump.innerText = `Trump: ${state.currentTrump ? SUIT_SYMBOLS[state.currentTrump] : '-'}`;
        this.elements.currentPhase.innerText = `Phase: ${state.phase.toUpperCase()}`;

        this.elements.playerAreas.forEach((area, idx) => {
            if (idx === state.currentPlayer) area.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.4)';
            else area.style.boxShadow = 'none';
        });

        this.renderTracker(state);

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
            this.elements.biddingStatus.innerText = state.phase === PHASES.GAME_OVER ? "Game Over! Thanks for playing." : "Round complete! Ready for next hand?";
            this.elements.biddingArea.classList.remove('hidden');
            this.elements.biddingControls.classList.remove('hidden');
            this.elements.btnTake.classList.add('hidden');
            this.elements.btnPass.classList.add('hidden');
            if (state.phase === PHASES.SCORING) {
                this.elements.btnNextRound.classList.remove('hidden');
            }
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
            this.elements.biddingStatus.innerText = `Your turn to bid (Round ${state.phase === PHASES.BIDDING_R1 ? '1' : '2'})`;
            this.elements.biddingControls.classList.remove('hidden');
            this.elements.suitSelection.classList.add('hidden');
            this.elements.btnTake.classList.remove('hidden');
            this.elements.btnPass.classList.remove('hidden');
        } else {
            this.elements.biddingStatus.innerText = `Waiting for Player ${state.currentPlayer}...`;
            this.elements.biddingControls.classList.add('hidden');
        }
    }

    renderHands(state) {
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
                    const isPlayable = state.phase === PHASES.PLAYING && state.currentPlayer === 0 &&
                        validCards.some(c => c.suit === card.suit && c.rank === card.rank);
                    const pts = card.getPoints(state.currentTrump);
                    const cardEl = this.renderCard(card, true, isPlayable, pts);
                    handContainer.appendChild(cardEl);
                } else {
                    // Bots see face down normally, but we show front to debug if required.
                    // Keep face down for normal gameplay.
                    const cardEl = this.renderCard(card, false);
                    handContainer.appendChild(cardEl);
                }
            });
        });
    }

    renderTrick(state) {
        this.elements.trickArea.innerHTML = '';
        const positions = ['bottom', 'left', 'top', 'right'];

        state.currentTrick.forEach(turn => {
            const pos = positions[turn.playerIndex];
            // Played cards are face up
            const cardEl = this.renderCard(turn.card, true, false, null);
            cardEl.classList.add('played-card', pos);
            // Re-apply random rotation deterministically per layout trick so it doesn't spin constantly
            const seed = turn.card.suit.length + turn.card.rank.length;
            cardEl.style.setProperty('--rot', `${(seed % 15) - 7}deg`);
            this.elements.trickArea.appendChild(cardEl);
        });
    }

    renderTracker(state) {
        if (!state.currentTrump || state.phase === PHASES.DEALING || state.phase.startsWith('bidding')) {
            this.elements.referenceGuide.classList.add('hidden');
            return;
        }

        this.elements.referenceGuide.classList.remove('hidden');
        this.elements.trackerContent.innerHTML = '';
        const playedMap = new Set(state.playedCards.map(c => `${c.suit}-${c.rank}`));

        const renderRow = (rank, pts, targetSuits) => {
            const row = document.createElement('div');
            row.className = 'ref-row';

            const cardsSpan = document.createElement('span');
            cardsSpan.innerText = `${rank} `;

            targetSuits.forEach(suit => {
                const isPlayed = playedMap.has(`${suit}-${rank}`);
                const icon = document.createElement('span');
                icon.innerText = SUIT_SYMBOLS[suit];
                if (isPlayed) icon.style.opacity = '0.2';
                else icon.style.color = (suit === 'hearts' || suit === 'diamonds') ? 'var(--card-red)' : 'var(--text-primary)';
                cardsSpan.appendChild(icon);
            });

            const ptsSpan = document.createElement('span');
            ptsSpan.innerText = `${pts} pts`;

            row.appendChild(cardsSpan);
            row.appendChild(ptsSpan);
            return row;
        };

        const normalSuits = Object.values(SUITS).filter(s => s !== state.currentTrump);

        // Trump section
        const tsHeader = document.createElement('h4');
        tsHeader.innerText = `Trump (${SUIT_SYMBOLS[state.currentTrump]})`;
        const tsSection = document.createElement('div');
        tsSection.className = 'ref-section';
        tsSection.appendChild(tsHeader);

        const trumpOrder = [
            { r: 'J', p: 20 }, { r: '9', p: 14 }, { r: 'A', p: 11 }, { r: '10', p: 10 },
            { r: 'K', p: 4 }, { r: 'Q', p: 3 }, { r: '8', p: 0 }, { r: '7', p: 0 }
        ];
        trumpOrder.forEach(item => tsSection.appendChild(renderRow(item.r, item.p, [state.currentTrump])));
        this.elements.trackerContent.appendChild(tsSection);

        // Normal section
        const nsHeader = document.createElement('h4');
        nsHeader.innerText = 'Other Suits';
        const nsSection = document.createElement('div');
        nsSection.className = 'ref-section';
        nsSection.appendChild(nsHeader);

        const normalOrder = [
            { r: 'A', p: 11 }, { r: '10', p: 10 }, { r: 'K', p: 4 }, { r: 'Q', p: 3 },
            { r: 'J', p: 2 }, { r: '9', p: 0 }, { r: '8', p: 0 }, { r: '7', p: 0 }
        ];
        normalOrder.forEach(item => nsSection.appendChild(renderRow(item.r, item.p, normalSuits)));
        this.elements.trackerContent.appendChild(nsSection);
    }
}


// --- app.js ---
document.addEventListener('DOMContentLoaded', () => {
    let ui;
    const engine = new GameEngine({
        onStateChange: (state) => {
            ai.processTurn();
            ui.render(state);
        },
        onTutorialEvent: (event) => {
            ui.showTutorial(event.title, event.message);
        }
    });

    const ai = new AIEngine(engine);
    ui = new GameInterface(engine);
    ui.render();
});
