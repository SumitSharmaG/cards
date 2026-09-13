import { RANKS, SUITS, type Card, type Rank, type Suit } from "./types.js";

export class Deck {
  private cards: Card[] = [];

  public constructor(cards?: Card[]) {
    this.cards = cards ? [...cards] : Deck.createStandardCards();
  }

  public static createStandardCards(): Card[] {
    return SUITS.flatMap((suit) =>
      RANKS.map((rank) => ({
        id: `${suit}-${rank}`,
        suit,
        rank,
      })),
    );
  }

  public get remaining(): number {
    return this.cards.length;
  }

  public shuffle(random: () => number = Math.random): void {
    for (let index = this.cards.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [this.cards[index], this.cards[swapIndex]] = [
        this.cards[swapIndex],
        this.cards[index],
      ];
    }
  }

  public cut(position: number): void {
    if (!Number.isInteger(position) || position <= 0 || position >= this.cards.length) {
      throw new Error("Cut position must split the deck into two non-empty parts.");
    }
    this.cards = [...this.cards.slice(position), ...this.cards.slice(0, position)];
  }

  public draw(): Card {
    const card = this.cards.shift();
    if (!card) {
      throw new Error("The deck is empty.");
    }
    return card;
  }

  public drawMany(count: number): Card[] {
    if (!Number.isInteger(count) || count < 0 || count > this.cards.length) {
      throw new Error("Cannot draw that number of cards.");
    }
    return Array.from({ length: count }, () => this.draw());
  }

  public peek(): Card {
    const card = this.cards[0];
    if (!card) {
      throw new Error("The deck is empty.");
    }
    return card;
  }

  public static card(suit: Suit, rank: Rank): Card {
    return { id: `${suit}-${rank}`, suit, rank };
  }
}