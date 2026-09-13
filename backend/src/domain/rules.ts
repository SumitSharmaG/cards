import type { Card, PlayedCard, Seat, Suit, TrickResult } from "./types.js";

const RANK_VALUE: Record<Card["rank"], number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export function isDehla(card: Card): boolean {
  return card.rank === "10";
}

export function canPlayCard(
  hand: readonly Card[],
  selectedCard: Card,
  leadSuit: Suit | null,
): boolean {
  if (!leadSuit) {
    return true;
  }
  if (selectedCard.suit === leadSuit) {
    return true;
  }
  return !hand.some((card) => card.suit === leadSuit);
}

export function compareCards(
  candidate: Card,
  current: Card,
  leadSuit: Suit,
  trump: Suit,
): number {
  const candidateTrump = candidate.suit === trump;
  const currentTrump = current.suit === trump;
  if (candidateTrump !== currentTrump) {
    return candidateTrump ? 1 : -1;
  }

  const candidateLead = candidate.suit === leadSuit;
  const currentLead = current.suit === leadSuit;
  if (candidateLead !== currentLead) {
    return candidateLead ? 1 : -1;
  }

  if (!candidateTrump && !candidateLead && !currentTrump && !currentLead) {
    return 0;
  }
  return RANK_VALUE[candidate.rank] - RANK_VALUE[current.rank];
}

export function determineTrickWinner(
  cards: readonly PlayedCard[],
  leadSuit: Suit,
  trump: Suit,
): TrickResult {
  if (cards.length === 0) {
    throw new Error("A trick needs at least one played card.");
  }

  let winner = cards[0];
  for (const candidate of cards.slice(1)) {
    if (compareCards(candidate.card, winner.card, leadSuit, trump) > 0) {
      winner = candidate;
    }
  }

  return {
    winnerId: winner.playerId,
    winnerSeat: winner.seat,
    winningCard: winner.card,
    leadSuit,
    cards: [...cards],
  };
}

export function nextSeat(seat: Seat): Seat {
  const order: Seat[] = ["south", "east", "north", "west"];
  const index = order.indexOf(seat);
  if (index < 0) {
    throw new Error(`Unknown seat: ${seat}`);
  }
  return order[(index + 1) % order.length] as Seat;
}

export function teamForSeat(seat: Seat): 1 | 2 {
  return seat === "north" || seat === "south" ? 1 : 2;
}