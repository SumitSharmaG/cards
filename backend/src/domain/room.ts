import { Deck } from "./deck.js";
import { Player } from "./player.js";
import {
  canPlayCard,
  determineTrickWinner,
  isDehla,
  nextSeat,
  teamForSeat,
} from "./rules.js";
import {
  CAPTURE_MODES,
  SEATS,
  type CaptureMode,
  type Card,
  type GamePhase,
  type PlayedCard,
  type Seat,
  type Suit,
  type TeamScore,
  type TrickResult,
} from "./types.js";

export class Room {
  public readonly id: string;
  private readonly pin: string;
  public readonly captureMode: CaptureMode;
  public hostId: string | null = null;
  public phase: GamePhase = "lobby";
  public trump: Suit | null = null;
  public trumpCard: Card | null = null;
  public turnSeat: Seat | null = null;
  public dealerSeat: Seat = "south";
  public deck: Deck | null = null;
  public centerPile: Card[] = [];
  public currentTrick: PlayedCard[] = [];
  public lastTrick: TrickResult | null = null;
  public shuffleTaps = 0;
  public cutPlayerId: string | null = null;
  public readonly players = new Map<string, Player>();
  public readonly scores: Record<1 | 2, TeamScore> = {
    1: { dehlas: 0, tricks: 0 },
    2: { dehlas: 0, tricks: 0 },
  };

  public constructor(id: string, pin: string, captureMode: CaptureMode) {
    if (!/^[A-Z0-9]{6}$/.test(id)) {
      throw new Error("Room ID must be six uppercase letters or numbers.");
    }
    if (!pin.trim()) {
      throw new Error("A room PIN is required.");
    }
    if (!CAPTURE_MODES.includes(captureMode)) {
      throw new Error("Unsupported Dehla capture mode.");
    }
    this.id = id;
    this.pin = pin;
    this.captureMode = captureMode;
  }

  public verifyPin(pin: string): boolean {
    return pin === this.pin;
  }

  public setHost(playerId: string): void {
    this.getPlayer(playerId);
    this.hostId = playerId;
  }

  public isHost(playerId: string): boolean {
    return this.hostId === playerId;
  }

  public addPlayer(player: Player): void {
    if (this.players.has(player.id)) {
      throw new Error("That player is already in the room.");
    }
    if (this.players.size >= 4) {
      throw new Error("This room is full.");
    }
    this.players.set(player.id, player);
  }

  public removePlayer(playerId: string): void {
    this.players.delete(playerId);
    if (this.hostId === playerId) {
      this.hostId = this.players.keys().next().value ?? null;
    }
    if (this.cutPlayerId === playerId) {
      this.cutPlayerId = null;
    }
  }

  public claimSeat(playerId: string, seat: Seat): void {
    if (this.phase !== "lobby") {
      throw new Error("Seats can only be claimed from the lobby.");
    }
    if (!SEATS.includes(seat)) {
      throw new Error("That seat does not exist.");
    }
    const player = this.getPlayer(playerId);
    if ([...this.players.values()].some((other) => other.seat === seat)) {
      throw new Error("That seat is already taken.");
    }
    if (player.seat) {
      throw new Error("Player has already claimed a seat.");
    }
    player.seat = seat;
  }

  public startPlaying(trump: Suit): void {
    if (this.players.size !== 4 || [...this.players.values()].some((player) => !player.seat)) {
      throw new Error("All four seats must be claimed before the round starts.");
    }
    this.phase = "playing";
    this.trump = trump;
    this.turnSeat = nextSeat(this.dealerSeat);
  }

  public prepareRound(): void {
    if (
      this.players.size !== 4 ||
      [...this.players.values()].some((player) => !player.seat)
    ) {
      throw new Error("All four seats must be claimed before the round starts.");
    }
    this.deck = new Deck();
    this.deck.shuffle();
    this.phase = "shuffling";
    this.trump = null;
    this.trumpCard = null;
    this.turnSeat = null;
    this.centerPile = [];
    this.currentTrick = [];
    this.lastTrick = null;
    this.shuffleTaps = 0;
    this.cutPlayerId = this.getPlayerAtSeat(nextSeat(this.dealerSeat))?.id ?? null;
    this.scores[1] = { dehlas: 0, tricks: 0 };
    this.scores[2] = { dehlas: 0, tricks: 0 };
    for (const player of this.players.values()) {
      player.hand = [];
      player.tricksWon = 0;
      player.dehlasCaptured = 0;
    }
  }

  public registerShuffleTap(playerId: string): number {
    this.requireDealer(playerId);
    if (this.phase !== "shuffling") {
      throw new Error("The deck is not in the shuffling phase.");
    }
    this.shuffleTaps += 1;
    return this.shuffleTaps;
  }

  public finishShuffle(playerId: string): void {
    this.requireDealer(playerId);
    if (this.phase !== "shuffling") {
      throw new Error("The deck is not in the shuffling phase.");
    }
    this.phase = "cutting";
  }

  public completeCut(playerId: string, durationMs: number): Card {
    if (this.phase !== "cutting") {
      throw new Error("The deck is not ready to be cut.");
    }
    if (playerId !== this.cutPlayerId) {
      throw new Error("Only the dealer's right-side player can cut.");
    }
    if (!this.deck) {
      throw new Error("The deck is missing.");
    }
    const safeDuration = Math.min(2200, Math.max(300, durationMs));
    const cutPosition = Math.round(8 + ((safeDuration - 300) / 1900) * 36);
    this.deck.cut(cutPosition);
    this.trumpCard = this.deck.peek();
    this.trump = this.trumpCard.suit;
    this.phase = "trump-reveal";
    return this.trumpCard;
  }

  public beginDealing(playerId: string): void {
    if (!this.isHost(playerId)) {
      throw new Error("Only the host can start dealing.");
    }
    if (this.phase !== "trump-reveal") {
      throw new Error("The trump must be revealed before dealing.");
    }
    this.phase = "dealing";
  }

  public finishDealing(): void {
    if (this.phase !== "dealing" || !this.trump) {
      throw new Error("The room is not ready to finish dealing.");
    }
    this.dealCards();
    this.phase = "playing";
    this.turnSeat = nextSeat(this.dealerSeat);
  }

  public setDeck(deck: Deck): void {
    this.deck = deck;
  }

  public dealCards(): void {
    if (!this.deck) {
      throw new Error("A deck must be prepared before dealing.");
    }
    if (this.players.size !== 4) {
      throw new Error("Exactly four players are required to deal.");
    }
    const seatedPlayers = this.seatedPlayersInOrder(this.dealerSeat);
    for (const player of seatedPlayers) {
      player.hand = [];
      player.tricksWon = 0;
      player.dehlasCaptured = 0;
    }
    for (let cardIndex = 0; cardIndex < 52; cardIndex += 1) {
      seatedPlayers[cardIndex % seatedPlayers.length]?.receive(this.deck.draw());
    }
  }

  public playCard(playerId: string, cardId: string): TrickResult | null {
    if (this.phase !== "playing" || !this.trump || !this.turnSeat) {
      throw new Error("The room is not ready for card play.");
    }
    const player = this.getPlayer(playerId);
    if (player.seat !== this.turnSeat) {
      throw new Error("It is not this player's turn.");
    }
    const card = player.hand.find((candidate) => candidate.id === cardId);
    if (!card) {
      throw new Error("That card is not in the player's hand.");
    }
    const leadSuit = this.currentTrick[0]?.card.suit ?? null;
    if (!canPlayCard(player.hand, card, leadSuit)) {
      throw new Error("You must follow the lead suit when possible.");
    }

    player.removeCard(cardId);
    this.currentTrick.push({
      playerId: player.id,
      seat: player.seat,
      card,
    });

    if (this.currentTrick.length < 4) {
      this.turnSeat = nextSeat(this.turnSeat);
      return null;
    }

    const trick = determineTrickWinner(
      this.currentTrick,
      leadSuit ?? card.suit,
      this.trump,
    );
    this.resolveTrick(trick);
    return trick;
  }

  public getPlayer(playerId: string): Player {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error("Player is not in this room.");
    }
    return player;
  }

  public getPlayerAtSeat(seat: Seat): Player | undefined {
    return [...this.players.values()].find((player) => player.seat === seat);
  }

  public getPublicState(): {
    id: string;
    hostId: string | null;
    phase: GamePhase;
    trump: Suit | null;
    trumpCard: Card | null;
    turnSeat: Seat | null;
    dealerSeat: Seat;
    captureMode: CaptureMode;
    shuffleTaps: number;
    cutPlayerId: string | null;
    seats: Record<
      Seat,
      { id: string; name: string; seat: Seat; team: 1 | 2 } | null
    >;
    centerPile: Card[];
    currentTrick: PlayedCard[];
    scores: Record<1 | 2, TeamScore>;
  } {
    const seats = Object.fromEntries(
      SEATS.map((seat) => {
        const player = [...this.players.values()].find((candidate) => candidate.seat === seat);
        return [
          seat,
          player
            ? { id: player.id, name: player.name, seat, team: player.team }
            : null,
        ];
      }),
    ) as Record<
      Seat,
      { id: string; name: string; seat: Seat; team: 1 | 2 } | null
    >;

    return {
      id: this.id,
      hostId: this.hostId,
      phase: this.phase,
      trump: this.trump,
      trumpCard: this.trumpCard,
      turnSeat: this.turnSeat,
      dealerSeat: this.dealerSeat,
      captureMode: this.captureMode,
      shuffleTaps: this.shuffleTaps,
      cutPlayerId: this.cutPlayerId,
      seats,
      centerPile: [...this.centerPile],
      currentTrick: [...this.currentTrick],
      scores: {
        1: { ...this.scores[1] },
        2: { ...this.scores[2] },
      },
    };
  }

  public getPrivateHand(playerId: string): readonly Card[] {
    return [...this.getPlayer(playerId).hand];
  }

  private resolveTrick(trick: TrickResult): void {
    const winner = this.getPlayer(trick.winnerId);
    const winningTeam = teamForSeat(trick.winnerSeat);
    winner.tricksWon += 1;
    this.scores[winningTeam] = {
      ...this.scores[winningTeam],
      tricks: this.scores[winningTeam].tricks + 1,
    };
    this.centerPile.push(...trick.cards.map((played) => played.card));
    this.lastTrick = trick;

    const dehlaCountInPile = this.centerPile.filter(isDehla).length;
    const shouldCapture =
      this.captureMode === "standard"
        ? trick.cards.some(({ card }) => isDehla(card))
        : this.captureMode === "village"
          ? dehlaCountInPile === 2 || dehlaCountInPile === 4
          : dehlaCountInPile >= 2 && dehlaCountInPile % 2 === 0;

    if (shouldCapture) {
      const capturedDehlas = this.centerPile.filter(isDehla).length;
      winner.dehlasCaptured += capturedDehlas;
      this.scores[winningTeam] = {
        ...this.scores[winningTeam],
        dehlas: this.scores[winningTeam].dehlas + capturedDehlas,
      };
      this.centerPile = [];
    }

    this.currentTrick = [];
    this.turnSeat = trick.winnerSeat;
    if ([...this.players.values()].every((player) => player.hand.length === 0)) {
      this.phase = "finished";
      this.turnSeat = null;
    }
  }

  private requireDealer(playerId: string): void {
    const dealer = this.getPlayerAtSeat(this.dealerSeat);
    if (!dealer || dealer.id !== playerId) {
      throw new Error("Only the dealer can perform this action.");
    }
  }

  private seatedPlayersInOrder(startSeat: Seat): Player[] {
    const result: Player[] = [];
    let seat = nextSeat(startSeat);
    for (let index = 0; index < 4; index += 1) {
      const player = [...this.players.values()].find((candidate) => candidate.seat === seat);
      if (!player) {
        throw new Error("Every seat must be occupied.");
      }
      result.push(player);
      seat = nextSeat(seat);
    }
    return result;
  }
}