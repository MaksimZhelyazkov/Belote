import { generateDeck, shuffleDeck, getValidMoves, getTrickWinner, calculateTrickPoints, SUITS, RANKS } from './CardLogic.js';

export const PHASES = {
    DEALING: 'dealing',
    BIDDING_R1: 'bidding-r1',
    BIDDING_R2: 'bidding-r2',
    PLAYING: 'playing',
    SCORING: 'scoring',
    GAME_OVER: 'game-over'
};

export class GameEngine {
    constructor(uiCallbacks = {}) {
        this.players = [[], [], [], []]; // 4 players, hands of cards
        this.scores = { NS: 0, EW: 0 }; // NS is You(0)+Partner(2), EW is AI1(1)+AI3(3)
        this.dealer = 3; // Starts with player right of You
        this.currentTrump = null;
        this.turnUpCard = null;
        this.currentTrick = []; // Array of { playerIndex, card }
        this.tricksWon = { NS: 0, EW: 0 };
        this.phase = PHASES.DEALING;
        this.currentPlayer = 0;
        this.taker = null; // Who took the bid
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
        this.dealer = (this.dealer + 1) % 4;

        this.phase = PHASES.DEALING;
        this.notifyState();
        this.dealInitialCards();
    }

    dealInitialCards() {
        // Deal 3, then 2 cards to each player starting from left of dealer
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

        // Turn up 21st card
        this.turnUpCard = this.deck[cardIndex++];
        this.deckIndex = cardIndex; // Save remaining index

        this.phase = PHASES.BIDDING_R1;
        this.currentPlayer = (this.dealer + 1) % 4;
        this.notifyState();
    }

    // Attempt to bid in round 1 or 2
    makeBid(playerIndex, suit = null) {
        if (playerIndex !== this.currentPlayer) return;

        if (suit !== null) {
            // Player takes the bid
            this.taker = playerIndex;
            this.currentTrump = suit;

            // Distribute remaining cards (3 to everyone except taker who gets 2 because they get the turnUpCard)
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
            this.currentPlayer = (this.dealer + 1) % 4; // Left of dealer leads
            this.notifyState();
            return;
        }

        // Passed
        this.currentPlayer = (this.currentPlayer + 1) % 4;

        // If everyone passed
        if (this.currentPlayer === (this.dealer + 1) % 4) {
            if (this.phase === PHASES.BIDDING_R1) {
                this.phase = PHASES.BIDDING_R2; // R2: Can choose any other suit
            } else {
                // All passed R2, redeal
                this.startNewRound();
                return;
            }
        }
        this.notifyState();
    }

    playCard(playerIndex, card) {
        if (this.phase !== PHASES.PLAYING || playerIndex !== this.currentPlayer) return;

        const hand = this.players[playerIndex];
        const validation = getValidMoves(hand, this.currentTrick, this.currentTrump);

        // Find the card in valid moves
        const isValid = validation.validCards.some(c => c.suit === card.suit && c.rank === card.rank);

        if (!isValid) {
            if (this.tutorialEnabled && playerIndex === 0) {
                this.onTutorialEvent({ message: validation.reason, title: "Invalid Move" });
            }
            return false; // Action rejected
        }

        // Remove from hand and add to trick
        const cIndex = hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
        hand.splice(cIndex, 1);
        this.currentTrick.push({ playerIndex, card });

        if (this.currentTrick.length === 4) {
            // Trick over
            this.currentPlayer = null; // Pause explicitly
            this.notifyState();

            setTimeout(() => this.resolveTrick(), 1500); // 1.5s delay to see the cards
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

        // Check for last trick (10 bonus points)
        if (this.players[0].length === 0) {
            this.tricksWon[winningTeam] += 10;
            this.phase = PHASES.SCORING;
            this.resolveRoundScore();
        } else {
            this.currentTrick = [];
            this.currentPlayer = winnerIndex; // Winner leads next
            this.notifyState();
        }
    }

    resolveRoundScore() {
        // Contract logic
        const takerTeam = (this.taker % 2 === 0) ? 'NS' : 'EW';
        const defenderTeam = takerTeam === 'NS' ? 'EW' : 'NS';

        let takerScore = this.tricksWon[takerTeam];
        let defenderScore = this.tricksWon[defenderTeam];

        // Capot (all tricks won) gets 252 (not implemented for simplicity, just base 162 total points)
        // Belote/Rebelote normally adds 20 points but we'll stick to trick points 162 total to avoid overcomplicating tutorial.

        // If taker team didn't get at least 82 points (assuming 162 total), they are "Inside" (Chute)
        // Then opponents get 162, taker gets 0.
        // Capot is rare enough, but usually adds 90. We'll implement basic contract.

        if (takerScore > defenderScore && takerScore >= 82) {
            this.scores.NS += this.tricksWon.NS;
            this.scores.EW += this.tricksWon.EW;
        } else {
            // Failed
            this.scores[defenderTeam] += 162;
            if (this.tutorialEnabled) {
                this.onTutorialEvent({
                    title: "Contract Failed",
                    message: "The team that took the bid failed to score more points than the defenders! Defenders get all 162 points."
                });
            }
        }

        if (this.scores.NS >= 1000 || this.scores.EW >= 1000) { // arbitrary game over limit
            this.phase = PHASES.GAME_OVER;
        } else {
            // Small pause before next hand
            setTimeout(() => this.startNewRound(), 4000);
        }
        this.notifyState();
    }

    notifyState() {
        this.onStateChange(this.getState());
    }

    getState() {
        return {
            phase: this.phase,
            players: this.players,
            scores: this.scores,
            currentTrump: this.currentTrump,
            turnUpCard: this.turnUpCard,
            currentTrick: this.currentTrick,
            currentPlayer: this.currentPlayer,
            taker: this.taker,
            tutorialEnabled: this.tutorialEnabled
        };
    }
}
