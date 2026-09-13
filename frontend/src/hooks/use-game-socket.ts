import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export type Seat = 'north' | 'east' | 'south' | 'west';
export type Phase = 'waiting' | 'ritual' | 'playing' | 'finished';
export type CaptureMode = 'standard' | 'village' | 'strict-pairs';
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export type Card = { id: string; suit: Suit | string; rank: string | number };
export type Player = { id: string; name: string; seat: Seat; team: 1 | 2 };
export type Room = {
  id: string;
  phase: Phase;
  rawPhase?: string;
  hostId?: string | null;
  trump?: Suit | string | null;
  trumpCard?: Card | null;
  turnSeat?: Seat | null;
  dealerSeat?: Seat | null;
  captureMode: CaptureMode;
  shuffleTaps?: number;
  cutPlayerId?: string | null;
  seats: Partial<Record<Seat, Player | null>>;
  centerPile: Card[];
  currentTrick: Array<{ playerId?: string; seat?: Seat; card: Card }>;
  scores: [number, number];
};

type ConnectionState = 'connecting' | 'connected' | 'disconnected';
type Identity = { playerId?: string; name: string; roomId?: string; pin?: string; seat?: Seat };

const API_URL = import.meta.env.VITE_BACKEND_URL || '/game-api';
const IDENTITY_KEY = 'dehla-pakad-player';

const emptyRoom = (id: string): Room => ({
  id,
  phase: 'waiting',
  captureMode: 'standard',
  seats: { north: null, east: null, south: null, west: null },
  centerPile: [],
  currentTrick: [],
  scores: [0, 0],
});

const normalizeRoom = (value: unknown): Room | null => {
  const raw = (value && typeof value === 'object' && 'room' in value)
    ? (value as { room: unknown }).room
    : value;
  if (!raw || typeof raw !== 'object') return null;
  const room = raw as Partial<Room> & { id?: string; seats?: Record<Seat, Player | null> };
  if (!room.id) return null;
  const rawPhase = String(room.phase ?? 'lobby');
  const phase: Phase = rawPhase === 'playing'
    ? 'playing'
    : rawPhase === 'finished'
      ? 'finished'
      : rawPhase === 'lobby'
        ? 'waiting'
        : 'ritual';
  const rawScores = room.scores as unknown;
  const scores: [number, number] = Array.isArray(rawScores)
    ? [Number(rawScores[0] ?? 0), Number(rawScores[1] ?? 0)]
    : rawScores && typeof rawScores === 'object'
      ? [
          Number((rawScores as { 1?: { dehlas?: number } })[1]?.dehlas ?? 0),
          Number((rawScores as { 2?: { dehlas?: number } })[2]?.dehlas ?? 0),
        ]
      : [0, 0];
  return {
    ...emptyRoom(room.id),
    ...room,
    rawPhase,
    phase,
    seats: { ...emptyRoom(room.id).seats, ...(room.seats ?? {}) },
    centerPile: Array.isArray(room.centerPile) ? room.centerPile : [],
    currentTrick: Array.isArray(room.currentTrick) ? room.currentTrick : [],
    scores,
  };
};

export function readPlayerIdentity(): Identity {
  try {
    const saved = localStorage.getItem(IDENTITY_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Identity;
      if (parsed.name) return parsed;
    }
  } catch {
    // Local storage can be unavailable in private browsing.
  }
  return { name: '' };
}

function saveIdentity(identity: Identity) {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // Identity is a convenience, not a reason to block the game.
  }
}

export function useGameSocket() {
  const socketRef = useRef<Socket | null>(null);
  const identityRef = useRef<Identity>(readPlayerIdentity());
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [room, setRoom] = useState<Room | null>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [identity, setIdentity] = useState<Identity>(identityRef.current);
  const [error, setError] = useState('');
  const [serverReady, setServerReady] = useState(false);

  useEffect(() => {
    const socket = io(API_URL, {
      path: getSocketPath(API_URL),
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
    });
    socketRef.current = socket;

    const onConnect = () => {
      setConnection('connected');
      setError('');
      const currentIdentity = identityRef.current;
      if (currentIdentity.roomId && currentIdentity.name) {
        socket.emit('join_room', {
          roomId: currentIdentity.roomId,
          name: currentIdentity.name,
          pin: currentIdentity.pin,
          playerId: currentIdentity.playerId,
        });
      }
    };
    const onDisconnect = () => setConnection('disconnected');
    const onRoomState = (payload: unknown) => {
      const next = normalizeRoom(payload);
      if (!next) return;
      setRoom(next);
      setError('');
      const currentIdentity = identityRef.current;
      const me = Object.values(next.seats).find((seat) => seat?.id === currentIdentity.playerId || seat?.name === currentIdentity.name);
      if (me) {
        const nextIdentity = { ...currentIdentity, playerId: me.id, seat: me.seat, roomId: next.id };
        identityRef.current = nextIdentity;
        setIdentity(nextIdentity);
        saveIdentity(nextIdentity);
      }
    };
    const onPrivateHand = (payload: unknown) => {
      const raw = payload && typeof payload === 'object' && 'hand' in payload ? (payload as { hand: unknown }).hand : payload;
      if (Array.isArray(raw)) setHand(raw as Card[]);
    };
    const onGameError = (payload: unknown) => {
      const message = typeof payload === 'string'
        ? payload
        : payload && typeof payload === 'object' && 'message' in payload
          ? String((payload as { message: unknown }).message)
          : 'That move was not accepted. Try again.';
      setError(message);
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('server_ready', () => setServerReady(true));
    socket.on('room_state', onRoomState);
    socket.on('private_hand', onPrivateHand);
    socket.on('game_error', onGameError);
    if (socket.connected) onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room_state', onRoomState);
      socket.off('private_hand', onPrivateHand);
      socket.off('game_error', onGameError);
      socket.disconnect();
      socketRef.current = null;
    };
    // Socket should be created once; reconnect uses the latest stored identity through emit payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = useCallback((event: string, payload?: unknown) => {
    if (!socketRef.current?.connected) {
      setError('You are offline. We will send that when the table reconnects.');
      return false;
    }
    socketRef.current.emit(event, payload);
    return true;
  }, []);

  const enterRoom = useCallback((next: { name: string; roomId?: string; pin: string; captureMode?: CaptureMode }) => {
    const nextIdentity = {
      ...identityRef.current,
      name: next.name.trim(),
      roomId: next.roomId?.trim().toUpperCase() || undefined,
      pin: next.pin.trim(),
    };
    identityRef.current = nextIdentity;
    setIdentity(nextIdentity);
    saveIdentity(nextIdentity);
    if (next.roomId) {
      return emit('join_room', { roomId: next.roomId.trim().toUpperCase(), name: next.name.trim(), pin: next.pin.trim(), playerId: nextIdentity.playerId });
    }
    return emit('create_room', { name: next.name.trim(), pin: next.pin.trim(), captureMode: next.captureMode ?? 'standard', playerId: nextIdentity.playerId });
  }, [emit]);

  const claimSeat = useCallback((seat: Seat) => emit('claim_seat', { seat }), [emit]);
  const startGame = useCallback((captureMode: CaptureMode) => emit('start_game', { captureMode }), [emit]);
  const shuffleTap = useCallback(() => emit('shuffle_tap'), [emit]);
  const shuffleDone = useCallback(() => emit('shuffle_done'), [emit]);
  const cutComplete = useCallback((durationMs = 800) => emit('cut_complete', { durationMs }), [emit]);
  const startDeal = useCallback(() => emit('start_deal'), [emit]);
  const playCard = useCallback((card: Card) => emit('play_card', { cardId: card.id, card }), [emit]);
  const leaveRoom = useCallback(() => {
    emit('leave_room');
    const nextIdentity = { name: identityRef.current.name };
    identityRef.current = nextIdentity;
    setIdentity(nextIdentity);
    saveIdentity(nextIdentity);
    setRoom(null);
    setHand([]);
    setError('');
  }, [emit]);

  return {
    connection,
    serverReady,
    room,
    hand,
    identity,
    error,
    setError,
    enterRoom,
    claimSeat,
    startGame,
    shuffleTap,
    shuffleDone,
    cutComplete,
    startDeal,
    playCard,
    leaveRoom,
  };
}

export { emptyRoom };

function getSocketPath(url: string): string {
  if (!url.startsWith('http')) {
    return `${url.replace(/\/$/, '')}/socket.io`;
  }
  try {
    const pathname = new URL(url).pathname.replace(/\/$/, '');
    return `${pathname}/socket.io`;
  } catch {
    return '/socket.io';
  }
}