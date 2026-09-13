import { Room } from "./room.js";
import type { CaptureMode } from "./types.js";

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  public createRoom(pin: string, captureMode: CaptureMode = "standard"): Room {
    let id = this.generateId();
    while (this.rooms.has(id)) {
      id = this.generateId();
    }
    const room = new Room(id, pin, captureMode);
    this.rooms.set(id, room);
    return room;
  }

  public getRoom(id: string): Room {
    const room = this.rooms.get(id);
    if (!room) {
      throw new Error("Room not found.");
    }
    return room;
  }

  public hasRoom(id: string): boolean {
    return this.rooms.has(id);
  }

  public removeIfEmpty(id: string): void {
    const room = this.rooms.get(id);
    if (room && room.players.size === 0) {
      this.rooms.delete(id);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
  }
}