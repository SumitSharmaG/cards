import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { Player } from "./domain/player.js";
import { RoomManager } from "./domain/room-manager.js";
import { CAPTURE_MODES, type CaptureMode, type Seat } from "./domain/types.js";

const port = Number(process.env["PORT"] ?? 10000);
const clientOrigin = process.env["CLIENT_ORIGIN"] ?? "http://localhost:3000";
const basePath = (process.env["BASE_PATH"] ?? "").replace(/\/$/, "");
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: `${basePath}/socket.io`,
  cors: {
    origin: clientOrigin === "*" ? true : clientOrigin,
    methods: ["GET", "POST"],
  },
});
const roomManager = new RoomManager();
const sessions = new Map<string, { roomId: string; playerId: string }>();

app.use(cors({ origin: clientOrigin === "*" ? true : clientOrigin }));
app.use(express.json());

app.get(`${basePath}/health`, (_request, response) => {
  response.json({ ok: true, service: "dehla-pakad-backend" });
});

io.on("connection", (socket) => {
  socket.emit("server_ready", {
    message: "Dehla Pakad server connected.",
  });

  socket.on("create_room", (payload: unknown, callback?: (value: unknown) => void) => {
    try {
      const input = parseRoomInput(payload);
      const playerId = input.playerId ?? randomUUID();
      const room = roomManager.createRoom(input.pin, input.captureMode);
      room.addPlayer(new Player(playerId, input.name));
      room.setHost(playerId);
      bindSocket(socket.id, room.id, playerId);
      socket.join(room.id);
      acknowledge(callback, { roomId: room.id, playerId });
      emitRoom(room.id);
    } catch (error) {
      sendError(socket, error);
    }
  });

  socket.on("join_room", (payload: unknown, callback?: (value: unknown) => void) => {
    try {
      const input = parseJoinInput(payload);
      const room = roomManager.getRoom(input.roomId);
      if (!room.verifyPin(input.pin)) {
        throw new Error("Incorrect room PIN.");
      }
      const existing = input.playerId ? room.players.get(input.playerId) : undefined;
      const playerId = existing?.id ?? input.playerId ?? randomUUID();
      if (!existing) {
        room.addPlayer(new Player(playerId, input.name));
      }
      bindSocket(socket.id, room.id, playerId);
      socket.join(room.id);
      acknowledge(callback, { roomId: room.id, playerId });
      emitRoom(room.id);
      emitPrivateHand(socket.id, room.id, playerId);
    } catch (error) {
      sendError(socket, error);
    }
  });

  socket.on("claim_seat", (payload: unknown) => {
    runForSocket(socket, (room, playerId) => {
      const seat = readSeat(payload);
      room.claimSeat(playerId, seat);
      emitRoom(room.id);
    });
  });

  socket.on("start_game", () => {
    runForSocket(socket, (room, playerId) => {
      if (!room.isHost(playerId)) {
        throw new Error("Only the host can start the game.");
      }
      room.prepareRound();
      emitRoom(room.id);
    });
  });

  socket.on("shuffle_tap", () => {
    runForSocket(socket, (room, playerId) => {
      room.registerShuffleTap(playerId);
      emitRoom(room.id);
    });
  });

  socket.on("shuffle_done", () => {
    runForSocket(socket, (room, playerId) => {
      room.finishShuffle(playerId);
      emitRoom(room.id);
    });
  });

  socket.on("cut_complete", (payload: unknown) => {
    runForSocket(socket, (room, playerId) => {
      const durationMs =
        typeof payload === "object" &&
        payload !== null &&
        "durationMs" in payload &&
        typeof payload.durationMs === "number"
          ? payload.durationMs
          : 800;
      room.completeCut(playerId, durationMs);
      emitRoom(room.id);
    });
  });

  socket.on("start_deal", () => {
    runForSocket(socket, (room, playerId) => {
      room.beginDealing(playerId);
      emitRoom(room.id);
      setTimeout(() => {
        if (!roomManager.hasRoom(room.id) || room.phase !== "dealing") {
          return;
        }
        try {
          room.finishDealing();
          emitRoom(room.id);
        } catch (error) {
          emitRoomError(room.id, error);
        }
      }, 2200);
    });
  });

  socket.on("play_card", (payload: unknown) => {
    runForSocket(socket, (room, playerId) => {
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("cardId" in payload) ||
        typeof payload.cardId !== "string"
      ) {
        throw new Error("A card ID is required.");
      }
      room.playCard(playerId, payload.cardId);
      emitRoom(room.id);
    });
  });

  socket.on("leave_room", () => {
    const session = sessions.get(socket.id);
    if (!session) {
      return;
    }
    const room = roomManager.getRoom(session.roomId);
    room.removePlayer(session.playerId);
    sessions.delete(socket.id);
    socket.leave(room.id);
    roomManager.removeIfEmpty(room.id);
    if (roomManager.hasRoom(room.id)) {
      emitRoom(room.id);
    }
  });

  socket.on("disconnect", () => {
    sessions.delete(socket.id);
  });
});

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Dehla Pakad backend listening on port ${port}`);
});

export { app, io, roomManager };

function bindSocket(socketId: string, roomId: string, playerId: string): void {
  sessions.set(socketId, { roomId, playerId });
}

function runForSocket(
  socket: Parameters<Parameters<typeof io.on>[1]>[0],
  operation: (room: ReturnType<RoomManager["getRoom"]>, playerId: string) => void,
): void {
  const session = sessions.get(socket.id);
  if (!session) {
    sendError(socket, new Error("Join a room first."));
    return;
  }
  try {
    const room = roomManager.getRoom(session.roomId);
    operation(room, session.playerId);
  } catch (error) {
    sendError(socket, error);
  }
}

function emitRoom(roomId: string): void {
  const room = roomManager.getRoom(roomId);
  io.to(roomId).emit("room_state", room.getPublicState());
  for (const [socketId, session] of sessions) {
    if (session.roomId === roomId) {
      emitPrivateHand(socketId, roomId, session.playerId);
    }
  }
}

function emitPrivateHand(socketId: string, roomId: string, playerId: string): void {
  const room = roomManager.getRoom(roomId);
  io.to(socketId).emit("private_hand", {
    playerId,
    hand: room.getPrivateHand(playerId),
  });
}

function emitRoomError(roomId: string, error: unknown): void {
  io.to(roomId).emit("game_error", { message: errorMessage(error) });
}

function sendError(
  socket: Parameters<Parameters<typeof io.on>[1]>[0],
  error: unknown,
): void {
  socket.emit("game_error", { message: errorMessage(error) });
}

function acknowledge(
  callback: ((value: unknown) => void) | undefined,
  value: unknown,
): void {
  callback?.(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function parseRoomInput(payload: unknown): {
  name: string;
  pin: string;
  captureMode: CaptureMode;
  playerId?: string;
} {
  if (!isRecord(payload)) {
    throw new Error("Room details are required.");
  }
  const name = readString(payload.name, "Your name is required.");
  const pin = readString(payload.pin, "A room PIN is required.");
  const captureMode = payload.captureMode;
  if (!CAPTURE_MODES.includes(captureMode as CaptureMode)) {
    throw new Error("Choose a valid Dehla capture mode.");
  }
  return {
    name,
    pin,
    captureMode: captureMode as CaptureMode,
    playerId: readOptionalString(payload.playerId),
  };
}

function parseJoinInput(payload: unknown): {
  roomId: string;
  name: string;
  pin: string;
  playerId?: string;
} {
  if (!isRecord(payload)) {
    throw new Error("Room details are required.");
  }
  return {
    roomId: readString(payload.roomId, "Room ID is required.").toUpperCase(),
    name: readString(payload.name, "Your name is required."),
    pin: readString(payload.pin, "Room PIN is required."),
    playerId: readOptionalString(payload.playerId),
  };
}

function readSeat(payload: unknown): Seat {
  const value =
    isRecord(payload) && typeof payload.seat === "string" ? payload.seat : "";
  if (value !== "north" && value !== "east" && value !== "south" && value !== "west") {
    throw new Error("Choose a valid seat.");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, error: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(error);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}