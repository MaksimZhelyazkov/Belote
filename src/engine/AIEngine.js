import { PHASES } from './GameEngine.js';
import { getValidMoves, calculateTrickPoints, SUITS } from './CardLogic.js';

export class AIEngine {
    constructor(gameEngine) {
        this.game = gameEngine;
        this.thinkingTimes = { min: 800, max: 2000 };
    }

    // Triggered on game state change
    processTurn() {
        const state = this.game.getState();
        const pIndex = state.currentPlayer;

        // If it's not an AI's turn, do nothing
        if (pIndex === null || pIndex === 0) return;

        if (state.phase === PHASES.BIDDING_R1 || state.phase === PHASES.BIDDING_R2) {
            this.scheduleAction(() => this.makeBiddingDecision(state, pIndex));
        } else if (state.phase === PHASES.PLAYING) {
            this.scheduleAction(() => this.makePlayDecision(state, pIndex));
        }
    }

    scheduleAction(action) {
        // Random timeout to simulate thinking
        const delay = Math.floor(Math.random() * (this.thinkingTimes.max - this.thinkingTimes.min)) + this.thinkingTimes.min;
        setTimeout(action, delay);
    }

    makeBiddingDecision(state, pIndex) {
        // Simple AI: Take if you have at least 2 trumps and a J or 9 in the proposed suit
        let bidSuit = null;
        const hand = state.players[pIndex];

        if (state.phase === PHASES.BIDDING_R1) {
            const proposed = state.turnUpCard.suit;
            const trumps = hand.filter(c => c.suit === proposed);
            const hasGoodTrump = trumps.some(c => c.rank === 'J' || c.rank === '9');

            if (trumps.length >= 2 && hasGoodTrump) {
                bidSuit = proposed;
            }
        } else {
            // R2: evaluate all other suits
            const proposedR1 = state.turnUpCard.suit;
            for (const suit of Object.values(SUITS)) {
                if (suit === proposedR1) continue;

                const trumps = hand.filter(c => c.suit === suit);
                const hasGoodTrump = trumps.some(c => c.rank === 'J' || c.rank === '9');
                if (trumps.length >= 3 && hasGoodTrump) {
                    bidSuit = suit;
                    break;
                }
            }
        }

        this.game.makeBid(pIndex, bidSuit);
    }

    makePlayDecision(state, pIndex) {
        const hand = state.players[pIndex];
        const validation = getValidMoves(hand, state.currentTrick, state.currentTrump);

        const validCards = validation.validCards;
        if (validCards.length === 0) return; // Should never happen unless hand is empty

        // Basic AI: Play random valid card
        // A smarter AI would try to win the trick if points are high, or discard low if losing.
        // For tutorial purposes, a slightly randomized reasonable play is fine.

        let chosenCard = validCards[0];

        // Evaluate trick winning logic roughly:
        if (state.currentTrick.length > 0) {
            const leadSuit = state.currentTrick[0].card.suit;

            // Partner is playerIndex - 2 or + 2
            const partnerIndex = (pIndex + 2) % 4;
            const partnerTurn = state.currentTrick.find(t => t.playerIndex === partnerIndex);

            // Is partner currently winning?
            let partnerWinning = false;
            // Simplified check: we assume partner isn't winning to force a bit more challenging play

            // Try to win if we can
            const winningCards = validCards.filter(c => {
                let isWinner = true;
                for (const t of state.currentTrick) {
                    if (t.card.getPower(state.currentTrump, leadSuit) >= c.getPower(state.currentTrump, leadSuit)) {
                        isWinner = false;
                    }
                }
                return isWinner;
            });

            if (winningCards.length > 0) {
                // Play lowest winning card
                winningCards.sort((a, b) => a.getPower(state.currentTrump, leadSuit) - b.getPower(state.currentTrump, leadSuit));
                chosenCard = winningCards[0];
            } else {
                // Play lowest valid card to discard
                validCards.sort((a, b) => a.getPower(state.currentTrump, leadSuit) - b.getPower(state.currentTrump, leadSuit));
                chosenCard = validCards[0];
            }
        } else {
            // Leading trick: play random for now. In reality, play Aces or Trumps.
            chosenCard = validCards[Math.floor(Math.random() * validCards.length)];
        }

        this.game.playCard(pIndex, chosenCard);
    }
}
