import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Crown,
  DoorOpen,
  House,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Scissors,
  Settings2,
  Sparkles,
  Spade,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  type Card,
  type CaptureMode,
  type Phase,
  type Room,
  type Seat,
  type Suit,
  useGameSocket,
} from '@/hooks/use-game-socket';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

const seatLabels: Record<Seat, string> = { north: 'North', east: 'East', south: 'South', west: 'West' };
const seatOrder: Seat[] = ['north', 'east', 'south', 'west'];
const seatInitials: Record<Seat, string> = { north: 'N', east: 'E', south: 'S', west: 'W' };

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function suitMark(suit?: Suit | string | null) {
  const normalized = String(suit ?? '').toLowerCase();
  if (normalized.includes('heart')) return { mark: '♥', red: true };
  if (normalized.includes('diamond')) return { mark: '♦', red: true };
  if (normalized.includes('club')) return { mark: '♣', red: false };
  return { mark: '♠', red: false };
}

function prettyRank(rank: Card['rank']) {
  const value = String(rank).toLowerCase();
  return ({ ace: 'A', king: 'K', queen: 'Q', jack: 'J', 1: 'A', 11: 'J', 12: 'Q', 13: 'K' } as Record<string, string>)[value] ?? value;
}

function ConnectionPill({ state }: { state: 'connecting' | 'connected' | 'disconnected' }) {
  const isOnline = state === 'connected';
  const label = isOnline ? 'Table connected' : state === 'connecting' ? 'Finding the table' : 'Reconnecting';
  return (
    <div data-testid="status-connection" className="flex items-center gap-2 rounded-full border border-[rgba(133,109,71,.25)] bg-[rgba(255,250,236,.55)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-[#49605d]">
      {isOnline ? <Wifi size={13} /> : state === 'connecting' ? <LoaderCircle className="animate-spin" size={13} /> : <WifiOff size={13} />}
      <span className={`status-dot ${isOnline ? 'status-online' : state === 'connecting' ? 'status-connecting' : 'status-offline'}`} />
      {label}
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#d4a655] bg-[#1c4a4b] text-[#f4d58c] shadow-[0_5px_10px_rgba(45,40,25,.13)]">
        <span className="font-display text-[23px] leading-none">দ</span>
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#e5bc67] bg-[#c75a37] text-[9px] font-bold text-[#fff2d6]">4</span>
      </div>
      <div>
        <div className="font-display text-[23px] font-semibold leading-none tracking-[-.03em] text-[#1c4a4b]">Dehla Pakad</div>
        <div className="mt-1 font-mono-ui text-[9px] uppercase tracking-[.22em] text-[#8c7552]">a game of gathering</div>
      </div>
    </div>
  );
}

function ErrorNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-3 rounded-xl border border-[#d89a84] bg-[#fff0e9] px-4 py-3 text-sm text-[#8c4030]">
      <span data-testid="status-game-error">{message}</span>
      <button type="button" data-testid="button-dismiss-error" onClick={onDismiss} className="shrink-0 text-[#8c4030]"><ChevronDown size={16} className="rotate-180" /></button>
    </motion.div>
  );
}

function AppHeader({
  connection,
  room,
  name,
  onLeave,
  compact = false,
}: {
  connection: 'connecting' | 'connected' | 'disconnected';
  room?: Room | null;
  name?: string;
  onLeave?: () => void;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copyRoom = async () => {
    if (!room?.id) return;
    try { await navigator.clipboard.writeText(room.id); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch { /* clipboard is optional */ }
  };
  return (
    <header className={`relative z-10 mx-auto flex w-full max-w-[1360px] items-center justify-between px-5 py-5 md:px-8 ${compact ? 'pb-3' : ''}`}>
      <BrandMark />
      <div className="flex items-center gap-2 md:gap-4">
        <ConnectionPill state={connection} />
        {room && (
          <button type="button" data-testid="button-copy-room-code" onClick={copyRoom} className="hidden items-center gap-2 rounded-full border border-[rgba(133,109,71,.25)] bg-[rgba(255,250,236,.55)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-[#49605d] sm:flex">
            <span className="font-mono-ui text-[#1c4a4b]">{room.id}</span>
            {copied ? <Check size={13} className="text-[#3b9a6f]" /> : <Copy size={13} />}
          </button>
        )}
        {name && <div className="hidden items-center gap-2 border-l border-[#dac8a6] pl-4 text-sm text-[#60716c] md:flex"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d9a354] text-[10px] font-bold text-[#1c4a4b]">{initials(name)}</span>{name}</div>}
        {onLeave && <button type="button" data-testid="button-leave-room" onClick={onLeave} className="btn-quiet flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold"><LogOut size={14} /><span className="hidden sm:inline">Leave table</span></button>}
      </div>
    </header>
  );
}

function Landing({
  connection,
  identityName,
  error,
  onErrorDismiss,
   onEnter,
}: {
  connection: 'connecting' | 'connected' | 'disconnected';
  identityName: string;
  error: string;
  onErrorDismiss: () => void;
  onEnter: (details: { name: string; roomId?: string; pin: string; captureMode?: CaptureMode }) => void;
}) {
  const [name, setName] = useState(identityName);
  const [roomCode, setRoomCode] = useState('');
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<CaptureMode>('standard');
  const [intent, setIntent] = useState<'create' | 'join'>('create');
  const canEnter = name.trim().length > 1 && (intent === 'create' || roomCode.trim().length > 1);

  return (
    <div className="app-shell">
      <AppHeader connection={connection} compact />
      <main className="relative z-[1] mx-auto grid w-full max-w-[1220px] gap-12 px-5 pb-16 pt-7 md:grid-cols-[1.05fr_.95fr] md:items-center md:px-8 md:pt-16">
        <section className="max-w-[650px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e0bf7a] bg-[#fae9bc]/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.17em] text-[#8d6730]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c75a37]" /> Four seats. One table. No spectators.
          </div>
          <h1 className="font-display text-[clamp(4.1rem,9vw,8.2rem)] font-semibold leading-[.82] tracking-[-.075em] text-[#1c4a4b]">
            Bring the<br /><em className="font-normal text-[#c75a37]">adda</em> online.
          </h1>
          <p className="mt-8 max-w-[510px] text-[17px] leading-7 text-[#50625e] md:text-[19px]">
            Dehla Pakad is best played shoulder-to-shoulder. Pick a seat, call your friends in, and let the cards do the talking.
          </p>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-xs font-semibold text-[#8c7552]">
            <span className="flex items-center gap-2"><Users size={15} className="text-[#c75a37]" /> Four manual seats</span>
            <span className="flex items-center gap-2"><Sparkles size={15} className="text-[#c75a37]" /> Live table play</span>
            <span className="flex items-center gap-2"><House size={15} className="text-[#c75a37]" /> Made for the adda</span>
          </div>
        </section>

        <section className="relative">
          <div className="absolute -right-4 -top-7 hidden rotate-[8deg] font-display text-[19px] text-[#b79561] md:block">pull up a charpai →</div>
          <div className="paper-card relative overflow-hidden rounded-[28px] p-5 md:p-7">
            <div className="mb-6 flex items-start justify-between">
              <div><div className="font-display text-[27px] font-semibold text-[#1c4a4b]">{intent === 'create' ? 'Set the table' : 'Find your friends'}</div><div className="mt-1 text-sm text-[#6b746a]">{intent === 'create' ? 'Your name goes on the scorecard.' : 'Enter the room code your friend shared.'}</div></div>
              <div className="rounded-xl bg-[#e9d6aa] p-2.5 text-[#1c4a4b]"><Spade size={21} /></div>
            </div>
            <ErrorNotice message={error} onDismiss={onErrorDismiss} />
            <div className="mt-5 grid grid-cols-2 rounded-xl bg-[#e8dcc0] p-1">
              <button type="button" data-testid="button-intent-create" onClick={() => setIntent('create')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${intent === 'create' ? 'bg-[#fbf5e8] text-[#1c4a4b] shadow-sm' : 'text-[#837052]'}`}>Create a table</button>
              <button type="button" data-testid="button-intent-join" onClick={() => setIntent('join')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${intent === 'join' ? 'bg-[#fbf5e8] text-[#1c4a4b] shadow-sm' : 'text-[#837052]'}`}>Join a table</button>
            </div>
            <label className="mt-5 block text-[11px] font-bold uppercase tracking-[.12em] text-[#8c7552]" htmlFor="player-name">Your name</label>
            <input id="player-name" data-testid="input-player-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={22} placeholder="What should we call you?" className="mt-2 w-full rounded-xl border border-[#d8c5a0] bg-[#fffaf0]/70 px-4 py-3.5 text-[15px] text-[#1c4a4b] outline-none transition placeholder:text-[#a99a7d] focus:border-[#c75a37] focus:ring-2 focus:ring-[#c75a37]/15" />
             <label className="mt-5 block text-[11px] font-bold uppercase tracking-[.12em] text-[#8c7552]" htmlFor="room-pin">Room PIN</label>
             <input id="room-pin" data-testid="input-room-pin" type="password" value={pin} onChange={(event) => setPin(event.target.value)} maxLength={24} placeholder={intent === 'create' ? 'Create a PIN to share privately' : 'Enter the PIN from your friend'} className="mt-2 w-full rounded-xl border border-[#d8c5a0] bg-[#fffaf0]/70 px-4 py-3.5 text-[15px] text-[#1c4a4b] outline-none transition placeholder:text-[#a99a7d] focus:border-[#c75a37] focus:ring-2 focus:ring-[#c75a37]/15" />
            {intent === 'join' && (
              <>
                <label className="mt-5 block text-[11px] font-bold uppercase tracking-[.12em] text-[#8c7552]" htmlFor="room-code">Room code</label>
                <input id="room-code" data-testid="input-room-code" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} maxLength={12} placeholder="e.g. BANYAN7" className="mt-2 w-full rounded-xl border border-[#d8c5a0] bg-[#fffaf0]/70 px-4 py-3.5 font-mono-ui text-[15px] tracking-[.16em] text-[#1c4a4b] outline-none transition placeholder:font-sans placeholder:tracking-normal placeholder:text-[#a99a7d] focus:border-[#c75a37] focus:ring-2 focus:ring-[#c75a37]/15" />
              </>
            )}
            {intent === 'create' && (
              <div className="mt-5">
                <label className="block text-[11px] font-bold uppercase tracking-[.12em] text-[#8c7552]" htmlFor="capture-mode">Capture style</label>
                <div className="relative mt-2">
                  <select id="capture-mode" data-testid="select-capture-mode" value={mode} onChange={(event) => setMode(event.target.value as CaptureMode)} className="w-full appearance-none rounded-xl border border-[#d8c5a0] bg-[#fffaf0]/70 px-4 py-3.5 text-[15px] text-[#1c4a4b] outline-none focus:border-[#c75a37]">
                    <option value="standard">Standard · clean and classic</option>
                    <option value="village">Village · for the old hands</option>
                    <option value="strict-pairs">Strict pairs · no shortcuts</option>
                  </select>
                  <ChevronDown size={17} className="pointer-events-none absolute right-4 top-4 text-[#8c7552]" />
                </div>
              </div>
            )}
             <button type="button" data-testid="button-enter-table" disabled={!canEnter || !pin.trim()} onClick={() => onEnter({ name, roomId: intent === 'join' ? roomCode : undefined, pin, captureMode: mode })} className="btn-terra mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold shadow-[0_7px_0_#a44832] active:translate-y-1 active:shadow-none">
              {intent === 'create' ? 'Create the table' : 'Pull up a seat'} <ArrowRight size={17} />
            </button>
            <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#8c7552]"><CircleHelp size={13} /> Share the room code after you create it</div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            {['Shuffle', 'Cut', 'Dehla'].map((item, index) => <div key={item} className="canvas-dash rounded-xl px-2 py-3"><div className="font-display text-[21px] text-[#1c4a4b]">{index === 0 ? '52' : index === 1 ? '1' : '10'}</div><div className="mt-1 text-[9px] font-bold uppercase tracking-[.15em] text-[#958263]">{item}</div></div>)}
          </div>
        </section>
      </main>
      <div className="pointer-events-none absolute bottom-[-90px] left-[42%] hidden font-display text-[170px] font-semibold leading-none text-[#e9d8b3]/55 md:block">♣</div>
    </div>
  );
}

function SeatCard({ seat, player, isMine, onClaim }: { seat: Seat; player?: Room['seats'][Seat]; isMine: boolean; onClaim: () => void }) {
  return (
    <div className={`relative rounded-2xl border p-4 transition ${player ? 'border-[#d8bd83] bg-[#fff6de]/72' : 'canvas-dash'} ${isMine ? 'ring-2 ring-[#c75a37]/35' : ''}`}>
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[.13em] text-[#967d58]"><span>{seatLabels[seat]}</span><span className="font-mono-ui">{seatInitials[seat]}</span></div>
      {player ? (
        <div className="mt-5 flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ${isMine ? 'bg-[#c75a37] text-[#fff2d6]' : 'bg-[#1c4a4b] text-[#f6d994]'}`}>{initials(player.name)}</div><div className="min-w-0"><div className="truncate text-sm font-bold text-[#1c4a4b]">{player.name}</div><div className="mt-1 text-[10px] text-[#8c7552]">{isMine ? 'That’s you' : `Team ${player.team}`}</div></div>{isMine && <Check size={16} className="ml-auto text-[#c75a37]" />}</div>
      ) : (
        <button type="button" data-testid={`button-claim-seat-${seat}`} onClick={onClaim} className="mt-5 flex w-full items-center gap-2 text-left text-sm font-semibold text-[#9a8768] transition hover:text-[#c75a37]"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[#c6ad81] text-[#c6ad81]">+</span> Claim this seat</button>
      )}
    </div>
  );
}

function Lobby({ room, name, playerId, connection, error, onErrorDismiss, onClaim, onStart }: { room: Room; name: string; playerId?: string; connection: 'connecting' | 'connected' | 'disconnected'; error: string; onErrorDismiss: () => void; onClaim: (seat: Seat) => void; onStart: (mode: CaptureMode) => void }) {
  const occupied = Object.values(room.seats).filter(Boolean).length;
  const me = Object.values(room.seats).find((player) => player?.id === playerId || (!playerId && player?.name === name));
  const copyRoomCode = () => {
    if (navigator.clipboard) void navigator.clipboard.writeText(room.id);
  };
  return (
    <div className="app-shell">
      <AppHeader connection={connection} room={room} name={name} />
      <main className="relative z-[1] mx-auto w-full max-w-[1120px] px-5 pb-16 pt-5 md:px-8">
        <div className="grid gap-8 md:grid-cols-[1fr_330px] md:items-start">
          <section>
            <div className="mb-7 flex items-end justify-between"><div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#a07f4f]"><span className="h-1.5 w-1.5 rounded-full bg-[#c75a37]" /> Before the first hand</div><h1 className="mt-3 font-display text-[clamp(2.5rem,5vw,4.5rem)] font-semibold leading-[.92] tracking-[-.06em] text-[#1c4a4b]">Choose your<br /><em className="font-normal text-[#c75a37]">charpai.</em></h1></div><div className="hidden text-right md:block"><div className="font-mono-ui text-2xl font-bold text-[#1c4a4b]">{occupied}<span className="text-[#b9a27a]">/4</span></div><div className="mt-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#947b57]">players seated</div></div></div>
            <ErrorNotice message={error} onDismiss={onErrorDismiss} />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
               {seatOrder.map((seat) => <SeatCard key={seat} seat={seat} player={room.seats[seat]} isMine={room.seats[seat]?.id === playerId || (!playerId && room.seats[seat]?.name === name)} onClaim={() => onClaim(seat)} />)}
            </div>
            <div className="mt-7 flex items-center gap-3 rounded-2xl border border-[#d6c19a] bg-[#f9edcf]/65 px-4 py-3 text-sm text-[#6f715f]"><div className="rounded-lg bg-[#e7d1a1] p-2 text-[#1c4a4b]"><Users size={16} /></div><span><b className="text-[#1c4a4b]">{occupied < 4 ? `${4 - occupied} ${4 - occupied === 1 ? 'seat is' : 'seats are'}` : 'All four seats are'}</b> still waiting for a friend.</span></div>
          </section>
          <aside className="paper-card rounded-[24px] p-5 md:mt-16 md:p-6">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#9a7c52]"><Settings2 size={14} /> Table rules</div>
            <div className="mt-5 space-y-4">
              <div><div className="font-display text-[22px] text-[#1c4a4b]">{room.captureMode === 'strict-pairs' ? 'Strict pairs' : room.captureMode === 'village' ? 'Village style' : 'Standard capture'}</div><p className="mt-1 text-xs leading-5 text-[#727466]">{room.captureMode === 'strict-pairs' ? 'Only matching pairs may take the pile.' : room.captureMode === 'village' ? 'The rules your grandparents taught you.' : 'Classic Dehla Pakad, ready for a friendly hand.'}</p></div>
              <div className="village-rule pt-4"><div className="flex items-center justify-between text-xs"><span className="text-[#7b7869]">Room code</span><button type="button" data-testid="button-copy-room-lobby" onClick={copyRoomCode} className="font-mono-ui font-bold text-[#1c4a4b] underline decoration-[#c75a37]/45 underline-offset-4">{room.id} <Copy size={12} className="ml-1 inline" /></button></div></div>
            </div>
            <button type="button" data-testid="button-start-game" disabled={!me || occupied < 4} onClick={() => onStart(room.captureMode)} className="btn-primary mt-7 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold">{occupied < 4 ? `Waiting on ${4 - occupied} player${4 - occupied === 1 ? '' : 's'}` : 'Start the ritual'} <ArrowRight size={16} /></button>
            {!me && <div className="mt-3 text-center text-[11px] text-[#a07f4f]">Claim a seat before starting.</div>}
          </aside>
        </div>
      </main>
    </div>
  );
}

function Ritual({ room, playerId, connection, error, onErrorDismiss, onShuffle, onShuffleDone, onCut, onStartDeal, onLeave }: { room: Room; playerId?: string; connection: 'connecting' | 'connected' | 'disconnected'; error: string; onErrorDismiss: () => void; onShuffle: () => void; onShuffleDone: () => void; onCut: (durationMs?: number) => void; onStartDeal: () => void; onLeave: () => void }) {
  const step = room.rawPhase === 'cutting'
    ? 'cut'
    : room.rawPhase === 'trump-reveal'
      ? 'reveal'
      : room.rawPhase === 'dealing'
        ? 'deal'
        : 'shuffle';
  const stepIndex = ['shuffle', 'cut', 'reveal', 'deal'].indexOf(step);
  const isDealer = Boolean(room.dealerSeat && room.seats[room.dealerSeat]?.id === playerId);
  const isCutter = room.cutPlayerId === playerId;
  const isHost = room.hostId === playerId;
  const [pressStartedAt, setPressStartedAt] = useState<number | null>(null);
  const finishCut = () => {
    const durationMs = pressStartedAt ? Math.max(300, Date.now() - pressStartedAt) : 800;
    setPressStartedAt(null);
    onCut(durationMs);
  };
  return (
    <div className="app-shell">
      <AppHeader connection={connection} room={room} onLeave={onLeave} />
      <main className="relative z-[1] mx-auto w-full max-w-[1080px] px-5 pb-14 pt-5 md:px-8">
        <div className="text-center"><div className="text-[11px] font-bold uppercase tracking-[.19em] text-[#a07f4f]">The pre-game ritual</div><h1 className="mt-3 font-display text-[clamp(2.8rem,6vw,5.4rem)] font-semibold leading-[.9] tracking-[-.07em] text-[#1c4a4b]">A good game starts<br /><em className="font-normal text-[#c75a37]">with a little ceremony.</em></h1></div>
        <ErrorNotice message={error} onDismiss={onErrorDismiss} />
        <div className="mx-auto mt-9 flex max-w-[700px] items-center justify-center gap-0">
          {['shuffle', 'cut', 'reveal', 'deal'].map((label, index) => <div key={label} className="flex items-center"><div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${index <= stepIndex ? 'bg-[#c75a37] text-[#fff1d6]' : 'border border-[#cfbb93] text-[#a8916c]'}`}>{index < stepIndex ? <Check size={15} /> : index + 1}</div>{index < 3 && <div className={`h-px w-10 sm:w-24 ${index < stepIndex ? 'bg-[#c75a37]' : 'bg-[#cfbb93]'}`} />}</div>)}
        </div>
        <div className="paper-card mx-auto mt-7 max-w-[700px] overflow-hidden rounded-[28px] p-6 text-center md:p-10">
          <div className="relative mx-auto flex h-52 max-w-[370px] items-center justify-center">
            <motion.div animate={step === 'shuffle' ? { rotate: [0, -7, 7, -3, 0], x: [0, -7, 8, -2, 0] } : { rotate: -5 }} transition={step === 'shuffle' ? { repeat: Infinity, duration: 1.2 } : { duration: .5 }} className="card-face absolute h-36 w-24 rounded-xl p-2 shadow-lg"><div className="h-full rounded-lg border border-[#d1b882] bg-[#d7b565]"><div className="m-2 h-[calc(100%-16px)] rounded border border-[#8f6f37] opacity-55" /></div></motion.div>
            <motion.div animate={step === 'shuffle' ? { rotate: [0, 8, -6, 0], x: [0, 10, -8, 0] } : { rotate: 5 }} transition={step === 'shuffle' ? { repeat: Infinity, duration: 1.2, delay: .12 } : { duration: .5 }} className="card-face absolute h-36 w-24 rounded-xl p-2 shadow-lg"><div className="h-full rounded-lg border border-[#d1b882] bg-[#d7b565]"><div className="m-2 h-[calc(100%-16px)] rounded border border-[#8f6f37] opacity-55" /></div></motion.div>
            <motion.div animate={step === 'shuffle' ? { y: [0, -7, 0], rotate: [0, -2, 0] } : step === 'cut' ? { rotateY: 180 } : { y: -8 }} transition={{ duration: .7 }} className="card-face playing-card absolute z-10 h-36 w-24 rounded-xl p-3 text-left"><div className="flex justify-between font-display text-2xl font-bold"><span>A</span><span>♠</span></div><div className="mt-7 text-center font-display text-3xl">♠</div><div className="mt-5 rotate-180 text-right font-display text-2xl font-bold">A</div></motion.div>
            {step === 'reveal' && <motion.div initial={{ opacity: 0, scale: .7, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="absolute -right-1 top-2 z-20 flex h-14 w-14 items-center justify-center rounded-full border-4 border-[#f7e9c4] bg-[#c75a37] text-[#fff1d6] shadow-lg"><Sparkles size={22} /></motion.div>}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="font-display text-[31px] font-semibold text-[#1c4a4b]">{step === 'shuffle' ? 'Tap the deck' : step === 'cut' ? 'Cut the deck' : step === 'reveal' ? 'Turn the trump' : 'Deal the hand'}</div>
              <p className="mx-auto mt-2 max-w-[420px] text-sm leading-6 text-[#737467]">{step === 'shuffle' ? 'Everyone gets a turn. Give the cards a proper shuffle before the first deal.' : step === 'cut' ? 'One clean cut. Trust your instinct.' : step === 'reveal' ? 'The suit that sets the mood for this hand.' : 'The table is ready. Find your cards and play your first Dehla.'}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-7 flex justify-center gap-3">
             {step === 'shuffle' && isDealer && <div className="flex flex-wrap justify-center gap-3"><button type="button" data-testid="button-shuffle-tap" onClick={onShuffle} className="btn-primary flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"><RefreshCw size={16} /> Tap deck <span className="font-mono-ui">{room.shuffleTaps ?? 0}</span></button><button type="button" data-testid="button-shuffle-done" disabled={(room.shuffleTaps ?? 0) < 3} onClick={onShuffleDone} className="btn-terra flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"><Check size={16} /> Finish shuffle</button></div>}
             {step === 'shuffle' && !isDealer && <div className="flex items-center gap-2 rounded-xl bg-[#e9d6aa] px-5 py-3 text-sm font-bold text-[#1c4a4b]"><LoaderCircle className="animate-spin" size={16} /> Waiting for the dealer · {room.shuffleTaps ?? 0} taps</div>}
             {step === 'cut' && isCutter && <button type="button" data-testid="button-cut-complete" onPointerDown={() => setPressStartedAt(Date.now())} onPointerUp={finishCut} onPointerLeave={() => setPressStartedAt(null)} className="btn-primary flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold"><Scissors size={16} /> Hold to cut</button>}
             {step === 'cut' && !isCutter && <div className="flex items-center gap-2 rounded-xl bg-[#e9d6aa] px-5 py-3 text-sm font-bold text-[#1c4a4b]"><LoaderCircle className="animate-spin" size={16} /> Waiting for the cutter</div>}
             {step === 'reveal' && isHost && <button type="button" data-testid="button-reveal-trump" onClick={onStartDeal} className="btn-terra flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold"><Sparkles size={16} /> Show trump & deal</button>}
             {step === 'reveal' && !isHost && <div className="flex items-center gap-2 rounded-xl bg-[#e9d6aa] px-5 py-3 text-sm font-bold text-[#1c4a4b]"><LoaderCircle className="animate-spin" size={16} /> Trump revealed · waiting for host</div>}
             {step === 'deal' && <div className="flex items-center gap-2 rounded-xl bg-[#e9d6aa] px-5 py-3 text-sm font-bold text-[#1c4a4b]"><LoaderCircle className="animate-spin" size={16} /> Dealing cards…</div>}
          </div>
           {room.trumpCard && <div className="mt-5 text-xs text-[#8b795d]">Trump card: <b className={suitMark(room.trumpCard.suit).red ? 'text-[#c75a37]' : 'text-[#1c4a4b]'}>{prettyRank(room.trumpCard.rank)} {suitMark(room.trumpCard.suit).mark}</b></div>}
        </div>
      </main>
    </div>
  );
}

function CardView({ card, index, playable, onPlay }: { card: Card; index: number; playable: boolean; onPlay: () => void }) {
  const suit = suitMark(card.suit);
  return (
    <motion.button type="button" data-testid={`button-play-card-${card.id}`} disabled={!playable} onClick={onPlay} initial={{ opacity: 0, y: 36, rotate: (index % 2 ? 4 : -4) }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: index * .045, type: 'spring', stiffness: 260, damping: 20 }} whileHover={playable ? { y: -18, rotate: (index % 2 ? 1 : -1) * 2 } : undefined} whileTap={playable ? { scale: .96, y: -8 } : undefined} className={`playing-card card-face relative h-[142px] w-[96px] shrink-0 rounded-xl p-2.5 text-left transition-[filter,opacity] sm:h-[166px] sm:w-[112px] ${suit.red ? 'red-suit' : ''} ${playable ? 'ring-2 ring-[#dda94b]/80' : 'opacity-[.82] grayscale-[.12]'}`} style={{ zIndex: index }}>
      <div className="flex justify-between font-display text-[23px] font-semibold leading-none"><span>{prettyRank(card.rank)}</span><span>{suit.mark}</span></div>
      <div className="flex h-[78px] items-center justify-center font-display text-[42px]">{suit.mark}</div>
      <div className="rotate-180 text-right font-display text-[23px] font-semibold leading-none">{prettyRank(card.rank)}</div>
      {playable && <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#c75a37] px-2 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-[#fff1d6]">play this</span>}
    </motion.button>
  );
}

function PlayerSeat({ seat, player, active, mine }: { seat: Seat; player?: Room['seats'][Seat]; active: boolean; mine: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${active ? 'bg-[#dcae59]/20' : ''}`}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold ${mine ? 'bg-[#c75a37] text-[#fff1d6]' : 'bg-[#e3c77f] text-[#1c4a4b]'} ${active ? 'seat-ring active' : ''}`}>{player ? initials(player.name) : seatInitials[seat]}</div>
      <div className="min-w-0"><div className="max-w-[86px] truncate text-xs font-bold text-[#f5e7c3]">{player?.name ?? 'Empty seat'}</div><div className="text-[9px] uppercase tracking-[.1em] text-[#adc6af]">{active ? 'playing now' : seatLabels[seat]}</div></div>
    </div>
  );
}

function GameTable({ room, hand, name, playerId, connection, error, onErrorDismiss, onPlay, onLeave }: { room: Room; hand: Card[]; name: string; playerId?: string; connection: 'connecting' | 'connected' | 'disconnected'; error: string; onErrorDismiss: () => void; onPlay: (card: Card) => void; onLeave: () => void }) {
  const me = Object.values(room.seats).find((player) => player?.id === playerId || (!playerId && player?.name === name));
  const canPlay = Boolean(me && room.turnSeat === me.seat);
  const trump = suitMark(room.trump);
  const orderedHand = useMemo(() => [...hand].sort((a, b) => String(a.suit).localeCompare(String(b.suit)) || Number(a.rank) - Number(b.rank)), [hand]);
  return (
    <div className="app-shell">
      <AppHeader connection={connection} room={room} name={name} onLeave={onLeave} />
      <main className="relative z-[1] mx-auto flex w-full max-w-[1420px] flex-col gap-4 px-3 pb-6 md:px-7">
        <div className="flex items-start justify-between px-2 md:px-0"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#a07f4f]"><span className="status-dot status-online" /> Hand in progress</div><h1 className="mt-1 font-display text-[29px] font-semibold text-[#1c4a4b]">The banyan table</h1></div><div className="flex items-center gap-2 rounded-xl border border-[#dcc494] bg-[#f7e9c9]/65 px-3 py-2 text-xs text-[#6e705f]"><span className="font-bold text-[#1c4a4b]">Trump</span><span className={trump.red ? 'text-[#c75a37]' : 'text-[#1c4a4b]'}>{trump.mark}</span><span className="hidden sm:inline">{String(room.trump ?? 'not revealed')}</span></div></div>
        <ErrorNotice message={error} onDismiss={onErrorDismiss} />
        <section className="table-felt relative min-h-[540px] overflow-hidden rounded-[26px] p-3 shadow-[0_22px_45px_rgba(22,63,60,.18)] md:min-h-[620px] md:p-6">
          <div className="relative z-[1] grid h-full min-h-[510px] grid-cols-[1fr_auto_1fr] grid-rows-[auto_1fr_auto] items-start gap-2 md:min-h-[568px]">
             <div className="col-start-2 row-start-1"><PlayerSeat seat="north" player={room.seats.north} active={room.turnSeat === 'north'} mine={room.seats.north?.id === playerId || (!playerId && room.seats.north?.name === name)} /></div>
             <div className="col-start-1 row-start-2 self-center justify-self-start"><PlayerSeat seat="west" player={room.seats.west} active={room.turnSeat === 'west'} mine={room.seats.west?.id === playerId || (!playerId && room.seats.west?.name === name)} /></div>
             <div className="col-start-3 row-start-2 self-center justify-self-end"><PlayerSeat seat="east" player={room.seats.east} active={room.turnSeat === 'east'} mine={room.seats.east?.id === playerId || (!playerId && room.seats.east?.name === name)} /></div>
             <div className="col-start-2 row-start-3 self-end"><PlayerSeat seat="south" player={room.seats.south} active={room.turnSeat === 'south'} mine={room.seats.south?.id === playerId || (!playerId && room.seats.south?.name === name)} /></div>
            <div className="col-start-2 row-start-2 flex min-w-[170px] flex-col items-center justify-center self-center">
              <div className="relative flex h-[160px] w-[180px] items-center justify-center">
                {room.centerPile.length > 0 ? room.centerPile.slice(-3).map((card, index) => <motion.div key={`${card.id}-${index}`} initial={{ opacity: 0, y: -30, rotate: -12 }} animate={{ opacity: 1, y: index * -2, rotate: (index - 1) * 5 }} className="card-face absolute h-[115px] w-[78px] rounded-lg p-2 text-left shadow-lg"><div className={`font-display text-xl font-bold ${suitMark(card.suit).red ? 'text-[#bd533c]' : ''}`}>{prettyRank(card.rank)} {suitMark(card.suit).mark}</div></motion.div>) : <div className="flex h-[102px] w-[70px] items-center justify-center rounded-lg border border-dashed border-[#9fc0ae]/45 text-center text-[10px] uppercase tracking-[.12em] text-[#afc9b1]">the pile<br />is waiting</div>}
              </div>
              <div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#b7cfb2]">{room.centerPile.length} cards captured</div>
              {room.currentTrick.length > 0 && <div className="mt-2 text-xs text-[#edca7b]">{room.currentTrick.length}/4 cards on the table</div>}
            </div>
          </div>
          <div className="pointer-events-none absolute left-4 top-4 text-[10px] uppercase tracking-[.15em] text-[#8fb2a4]">Round {Math.floor(room.centerPile.length / 4) + 1}</div>
          <div className="pointer-events-none absolute right-4 top-4 font-mono-ui text-[10px] uppercase tracking-[.12em] text-[#8fb2a4]">Team {me?.team ?? '—'} side</div>
        </section>
        <section className="rounded-[24px] border border-[#d4bd8f] bg-[#f8eacc]/70 px-3 pb-4 pt-5 md:px-6">
          <div className="flex items-center justify-between px-1"><div><div className="font-display text-[23px] font-semibold text-[#1c4a4b]">Your hand</div><div className="mt-0.5 text-[11px] text-[#82765f]">{canPlay ? 'Your move. Choose a card.' : room.turnSeat ? `${seatLabels[room.turnSeat]} is thinking…` : 'Waiting for the next deal'}</div></div><div className="flex items-center gap-2">{canPlay && <span className="flex items-center gap-1.5 rounded-full bg-[#c75a37] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.1em] text-[#fff1d6]"><span className="status-dot bg-[#f6d994]" /> Your turn</span>}<span className="font-mono-ui text-xs text-[#957b54]">{hand.length} cards</span></div></div>
          <div className="scroll-hide mt-5 flex min-h-[175px] items-end justify-start overflow-x-auto px-2 pb-2 pt-8 sm:justify-center">{orderedHand.length ? orderedHand.map((card, index) => <CardView key={card.id} card={card} index={index} playable={canPlay} onPlay={() => onPlay(card)} />) : <div className="canvas-dash my-5 rounded-xl px-6 py-4 text-center text-sm text-[#8f8066]">Your private hand will appear here when the deal arrives.</div>}</div>
        </section>
      </main>
    </div>
  );
}

function Scoreboard({ room, name, connection, onLeave }: { room: Room; name: string; connection: 'connecting' | 'connected' | 'disconnected'; onLeave: () => void }) {
  const winners = room.scores[0] >= room.scores[1] ? 1 : 2;
  return (
    <div className="app-shell">
      <AppHeader connection={connection} room={room} name={name} />
      <main className="relative z-[1] mx-auto w-full max-w-[960px] px-5 pb-16 pt-8 text-center md:px-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-4 border-[#f3d48a] bg-[#c75a37] text-[#fff0d3] shadow-lg"><Crown size={24} /></div>
        <div className="mt-5 text-[11px] font-bold uppercase tracking-[.2em] text-[#a07f4f]">The hand is over</div>
        <h1 className="mt-3 font-display text-[clamp(3.3rem,8vw,6.4rem)] font-semibold leading-[.84] tracking-[-.07em] text-[#1c4a4b]">That was a<br /><em className="font-normal text-[#c75a37]">proper game.</em></h1>
        <p className="mx-auto mt-6 max-w-[440px] text-sm leading-6 text-[#6e756a]">The cards have spoken. Here is how the teams fared around the banyan.</p>
        <div className="mx-auto mt-9 grid max-w-[700px] gap-3 text-left sm:grid-cols-2">
          {[1, 2].map((team) => <div key={team} className={`paper-card rounded-2xl p-5 ${winners === team ? 'border-[#d3a24f] ring-2 ring-[#d3a24f]/25' : ''}`}><div className="flex items-center justify-between"><div className="text-[10px] font-bold uppercase tracking-[.15em] text-[#967a52]">Team {team}</div>{winners === team && <div className="flex items-center gap-1 rounded-full bg-[#e7c77c] px-2 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-[#6d552d]"><Crown size={11} /> Winners</div>}</div><div className="mt-3 font-mono-ui text-5xl font-bold text-[#1c4a4b]">{room.scores[team - 1]}</div><div className="mt-2 text-xs text-[#827761]">{seatOrder.filter((seat) => room.seats[seat]?.team === team).map((seat) => room.seats[seat]?.name).filter(Boolean).join(' · ') || 'Your side of the table'}</div></div>)}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><button type="button" data-testid="button-play-again" onClick={onLeave} className="btn-primary flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"><RefreshCw size={16} /> New table</button><button type="button" data-testid="button-scoreboard-leave" onClick={onLeave} className="btn-quiet flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"><DoorOpen size={16} /> Leave the adda</button></div>
      </main>
    </div>
  );
}

function GameApp() {
  const socket = useGameSocket();
  const [, setLocation] = useLocation();
  const { room, connection, identity, error, setError } = socket;
  const phase: Phase = room?.phase ?? 'waiting';
  useEffect(() => {
    if (!room && window.location.pathname !== '/') setLocation('/');
  }, [room, setLocation]);
  if (!room) return <Landing connection={connection} identityName={identity.name} error={error} onErrorDismiss={() => setError('')} onEnter={socket.enterRoom} />;
  if (phase === 'waiting') return <Lobby room={room} name={identity.name} playerId={identity.playerId} connection={connection} error={error} onErrorDismiss={() => setError('')} onClaim={socket.claimSeat} onStart={socket.startGame} />;
  if (phase === 'ritual') return <Ritual room={room} playerId={identity.playerId} connection={connection} error={error} onErrorDismiss={() => setError('')} onShuffle={socket.shuffleTap} onShuffleDone={socket.shuffleDone} onCut={socket.cutComplete} onStartDeal={socket.startDeal} onLeave={socket.leaveRoom} />;
  if (phase === 'finished') return <Scoreboard room={room} name={identity.name} connection={connection} onLeave={socket.leaveRoom} />;
  return <GameTable room={room} hand={socket.hand} name={identity.name} playerId={identity.playerId} connection={connection} error={error} onErrorDismiss={() => setError('')} onPlay={socket.playCard} onLeave={socket.leaveRoom} />;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch><Route path="/" component={GameApp} /><Route component={NotFound} /></Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;