import type { Card, Seat, Team } from "./types.js";

export class Player {
  public readonly id: string;
  public readonly name: string;
  public seat: Seat | null;
  public hand: Card[] = [];
  public tricksWon = 0;
  public dehlasCaptured = 0;

  public constructor(id: string, name: string, seat: Seat | null = null) {
    this.id = id;
    this.name = name.trim();
    this.seat = seat;
  }

  public get team(): Team {
    return this.seat === "north" || this.seat === "south" ? 1 : 2;
  }

  public receive(card: Card): void {
    this.hand.push(card);
  }

  public hasCard(cardId: string): boolean {
    return this.hand.some((card) => card.id === cardId);
  }

  public removeCard(cardId: string): Card {
    const index = this.hand.findIndex((card) => card.id === cardId);
    if (index < 0) {
      throw new Error("That card is not in the player's hand.");
    }

    const [card] = this.hand.splice(index, 1);
    if (!card) {
      throw new Error("Unable to remove the selected card.");
    }
    return card;
  }
}