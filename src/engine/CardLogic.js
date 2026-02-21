// Belote Constants
export const SUITS = {
    HEARTS: 'hearts',
    DIAMONDS: 'diamonds',
    CLUBS: 'clubs',
    SPADES: 'spades'
};

export const SUIT_SYMBOLS = {
    [SUITS.HEARTS]: '♥️',
    [SUITS.DIAMONDS]: '♦️',
    [SUITS.CLUBS]: '♣️',
    [SUITS.SPADES]: '♠️'
};

export const RANKS = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];

// Non-trump points
export const POINTS_NORMAL = {
    '7': 0, '8': 0, '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 11
};

// Trump points
export const POINTS_TRUMP = {
    '7': 0, '8': 0, 'Q': 3, 'K': 4, '10': 10, 'A': 11, '9': 14, 'J': 20
};

// Hierarchy for winning tricks (highest to lowest index)
const HIERARCHY_NORMAL = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
const HIERARCHY_TRUMP = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J'];

export class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
    }

    getPoints(trumpSuit) {
        return this.suit === trumpSuit ? POINTS_TRUMP[this.rank] : POINTS_NORMAL[this.rank];
    }

    getPower(trumpSuit, leadSuit) {
        if (this.suit === trumpSuit) {
            return 200 + HIERARCHY_TRUMP.indexOf(this.rank); // Trump is always highest
        }
        if (this.suit === leadSuit) {
            return 100 + HIERARCHY_NORMAL.indexOf(this.rank); // Lead suit is next
        }
        return HIERARCHY_NORMAL.indexOf(this.rank); // Off-suit cannot win, but has relative power
    }

    isRed() {
        return this.suit === SUITS.HEARTS || this.suit === SUITS.DIAMONDS;
    }
}

export function generateDeck() {
    const deck = [];
    for (const suit of Object.values(SUITS)) {
        for (const rank of RANKS) {
            deck.push(new Card(suit, rank));
        }
    }
    return deck;
}

export function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Validation Logic for Classic Belote Play
// Returns an object: { validCards: Card[], reason: string (for tutorial) }
export function getValidMoves(hand, currentTrick, trumpSuit) {
    if (currentTrick.length === 0) {
        return { validCards: [...hand], reason: "You are leading the trick. You can play any card." };
    }

    const leadCard = currentTrick[0].card;
    const leadSuit = leadCard.suit;

    const cardsOfLeadSuit = hand.filter(c => c.suit === leadSuit);
    const trumpCards = hand.filter(c => c.suit === trumpSuit);

    // Rule 1: You must follow suit if possible
    if (cardsOfLeadSuit.length > 0) {
        // If the lead suit is trump, you must overtrump if possible
        if (leadSuit === trumpSuit) {
            let highestTrumpInTrickPower = -1;
            for (const turn of currentTrick) {
                if (turn.card.suit === trumpSuit) {
                    highestTrumpInTrickPower = Math.max(highestTrumpInTrickPower, turn.card.getPower(trumpSuit, leadSuit));
                }
            }
            const higherTrumps = cardsOfLeadSuit.filter(c => c.getPower(trumpSuit, leadSuit) > highestTrumpInTrickPower);

            if (higherTrumps.length > 0) {
                return { validCards: higherTrumps, reason: "When trumps are led, you must follow suit and overtrump if you can." };
            } else {
                return { validCards: cardsOfLeadSuit, reason: "You must follow suit (trump). You cannot overtrump, so any trump is valid." };
            }
        }

        return { validCards: cardsOfLeadSuit, reason: `You must follow the lead suit (${leadSuit}).` };
    }

    // Rule 2: Cannot follow suit -> Must trump (unless partner is winning the trick with a trump, in some sub-variants. We will use standard rule: must trump if possible)
    // To simplify tutorial for beginners, we use the strict "must trump" rule if you are not following suit, regardless of partner.
    if (trumpCards.length > 0) {
        // You must overtrump if an opponent has already trumped.
        const enemyTrumps = currentTrick
            .filter((turn, idx) => turn.card.suit === trumpSuit && (currentTrick.length - idx) % 2 !== 0); // Opponents are odd intervals away

        if (enemyTrumps.length > 0) {
            let highestEnemyTrump = Math.max(...enemyTrumps.map(t => t.card.getPower(trumpSuit, leadSuit)));
            const higherTrumps = trumpCards.filter(c => c.getPower(trumpSuit, leadSuit) > highestEnemyTrump);
            if (higherTrumps.length > 0) {
                return { validCards: higherTrumps, reason: "You cannot follow suit. You must overtrump the opponent." };
            }
            // Cannot overtrump, but still have to play a trump
            return { validCards: trumpCards, reason: "You cannot follow suit, and you cannot overtrump the opponent, but you must play a trump." };
        }

        return { validCards: trumpCards, reason: "You cannot follow suit, so you must play a trump card." };
    }

    // Rule 3: Cannot follow suit and have no trumps -> Discard anything
    return { validCards: [...hand], reason: "You cannot follow suit and have no trumps. You can discard any card." };
}

// Get the winning player index from a trick
export function getTrickWinner(trick, trumpSuit) {
    let winningIndex = 0;
    let highestPower = trick[0].card.getPower(trumpSuit, trick[0].card.suit);
    const leadSuit = trick[0].card.suit;

    for (let i = 1; i < trick.length; i++) {
        const power = trick[i].card.getPower(trumpSuit, leadSuit);
        if (power > highestPower) {
            highestPower = power;
            winningIndex = i;
        }
    }
    return trick[winningIndex].playerIndex;
}

export function calculateTrickPoints(trick, trumpSuit) {
    return trick.reduce((sum, turn) => sum + turn.card.getPoints(trumpSuit), 0);
}
