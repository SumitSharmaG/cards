export const SEATS = ["north", "east", "south", "west"] as const;
export type Seat = (typeof SEATS)[number];

export const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
] as const;
export type Rank = (typeof RANKS)[number];

export const CAPTURE_MODES = ["standard", "village", "strict-pairs"] as const;
export type CaptureMode = (typeof CAPTURE_MODES)[number];

export const GAME_PHASES = [
  "lobby",
  "shuffling",
  "cutting",
  "trump-reveal",
  "dealing",
  "playing",
  "finished",
] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

export type Team = 1 | 2;

export interface Card {
  readonly id: string;
  readonly suit: Suit;
  readonly rank: Rank;
}

export interface PlayedCard {
  readonly playerId: string;
  readonly seat: Seat;
  readonly card: Card;
}

export interface TrickResult {
  readonly winnerId: string;
  readonly winnerSeat: Seat;
  readonly winningCard: Card;
  readonly leadSuit: Suit;
  readonly cards: readonly PlayedCard[];
}

export interface TeamScore {
  readonly dehlas: number;
  readonly tricks: number;
}