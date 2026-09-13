import assert from "node:assert/strict";
import test from "node:test";
import { Deck } from "./deck.js";
import { Player } from "./player.js";
import { Room } from "./room.js";
import { canPlayCard, determineTrickWinner } from "./rules.js";

test("creates a standard 52-card deck", () => {
  const deck = new Deck();
  assert.equal(deck.remaining, 52);
});

test("requires a player to follow the lead suit", () => {
  const hand = [
    Deck.card("hearts", "A"),
    Deck.card("spades", "2"),
  ];
  assert.equal(canPlayCard(hand, hand[1], "hearts"), false);
  assert.equal(canPlayCard(hand, hand[0], "hearts"), true);
});

test("lets trump beat a higher off-suit card", () => {
  const cards = [
    { playerId: "p1", seat: "south" as const, card: Deck.card("hearts", "A") },
    { playerId: "p2", seat: "east" as const, card: Deck.card("spades", "2") },
  ];
  assert.equal(determineTrickWinner(cards, "hearts", "spades").winnerId, "p2");
});

test("captures a Dehla in standard mode", () => {
  const room = new Room("ABC123", "1234", "standard");
  room.addPlayer(new Player("p1", "North", "north"));
  room.addPlayer(new Player("p2", "East", "east"));
  room.addPlayer(new Player("p3", "South", "south"));
  room.addPlayer(new Player("p4", "West", "west"));
  room.startPlaying("spades");
  room.getPlayer("p1").receive(Deck.card("hearts", "10"));
  room.getPlayer("p2").receive(Deck.card("hearts", "2"));
  room.getPlayer("p3").receive(Deck.card("hearts", "3"));
  room.getPlayer("p4").receive(Deck.card("hearts", "4"));
  room.turnSeat = "north";

  room.playCard("p1", "hearts-10");
  room.playCard("p4", "hearts-4");
  room.playCard("p3", "hearts-3");
  room.playCard("p2", "hearts-2");

  assert.equal(room.scores[1].dehlas, 1);
  assert.equal(room.centerPile.length, 0);
});

test("moves through the server-authoritative pre-game ritual", () => {
  const room = new Room("RITUAL", "1234", "village");
  room.addPlayer(new Player("p1", "North", "north"));
  room.addPlayer(new Player("p2", "East", "east"));
  room.addPlayer(new Player("p3", "South", "south"));
  room.addPlayer(new Player("p4", "West", "west"));
  room.setHost("p3");
  room.prepareRound();
  assert.equal(room.phase, "shuffling");
  room.registerShuffleTap("p3");
  room.finishShuffle("p3");
  assert.equal(room.phase, "cutting");
  room.completeCut("p2", 1200);
  assert.equal(room.phase, "trump-reveal");
  assert.ok(room.trumpCard);
  room.beginDealing("p3");
  room.finishDealing();
  assert.equal(room.phase, "playing");
  assert.equal(room.getPrivateHand("p1").length, 13);
});