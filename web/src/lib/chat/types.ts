/** Team chat — shapes shared by the screen, the live (Firestore) store and the demo store. */

export type RoomKind = "channel" | "group" | "dm";

export interface ChatRoom {
  id: string;
  kind: RoomKind;
  /** Desk channels, groups. DMs are named after the other person on screen. */
  name: string;
  /** "all" = every signed-in colleague (the Everyone channel); "list" = only memberLogins. */
  audience: "all" | "list";
  /** Login ids (the part before @ in the sign-in email). Desk channels follow the seat, not one person. */
  memberLogins: string[];
  /** Set for desk channels so membership can be refreshed when the seat changes hands. */
  seatId?: string;
  createdBy: string;
  createdAt: number;
  lastMessageAt?: number;
  lastMessageText?: string;
  lastMessageBy?: string;
  /** Pinned message ids, newest last. */
  pinned?: string[];
  /** login -> time of the last message that @mentioned them. */
  mentioned?: Record<string, number>;
}

export interface ChatAttachment {
  name: string;
  size: number;
  type: string;
  /** Empty until the upload finishes (e.g. sent while offline). */
  url: string;
  status: "uploading" | "ready" | "failed";
}

export interface QuoteCard {
  id: string;
  ref: string;
  customer: string;
  mode: string;
  route: string;
  status: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderLogin: string;
  senderName: string;
  text: string;
  createdAtMs: number;
  /** When set, the message was written by the Vertex assistant at this person's request. */
  ai?: boolean;
  replyTo?: { id: string; name: string; snippet: string };
  attachments?: ChatAttachment[];
  quote?: QuoteCard;
  mentions?: string[];
  /** emoji -> logins who reacted */
  reactions?: Record<string, string[]>;
  editedAtMs?: number;
  deleted?: boolean;
  /** True while the message has only been saved on this device (sent offline). */
  pending?: boolean;
  /** The server refused it (for example you were removed from the chat). Stays on this device only. */
  failed?: boolean;
}

export interface ChatState {
  /** roomId -> time this person last read it */
  reads: Record<string, number>;
  muted: Record<string, boolean>;
  noticeAcceptedAt?: number;
  /** Browser notification tokens for this person's devices. */
  tokens?: string[];
}

export interface Presence {
  login: string;
  name: string;
  at: number;
}

export interface Typing {
  login: string;
  name: string;
  at: number;
}

export interface Person {
  login: string;
  name: string;
  /** Desk label such as "Air Desk", when the person sits in a desk seat. */
  desk?: string;
}

export interface Me {
  login: string;
  name: string;
  isAdmin: boolean;
}

export interface AuditEntry {
  id: string;
  by: string;
  roomId: string;
  roomName: string;
  at: number;
}

export type Unsubscribe = () => void;

/** The two stores (live and demo) both speak this. */
export interface ChatBackend {
  subscribeRooms(me: Me, cb: (rooms: ChatRoom[]) => void): Unsubscribe;
  subscribeMessages(roomId: string, max: number, cb: (messages: ChatMessage[]) => void): Unsubscribe;
  /** Saves immediately on this device and sends when online. Never waits for the network. */
  sendMessage(msg: ChatMessage): void;
  patchMessage(roomId: string, id: string, patch: Partial<ChatMessage>): void;
  setReaction(roomId: string, id: string, emoji: string, login: string, on: boolean): void;
  createRoom(room: ChatRoom): Promise<void>;
  patchRoom(roomId: string, patch: Record<string, unknown>): void;
  /** Admin: make sure the desk channels exist and list the right people. */
  syncDeskChannels(rooms: ChatRoom[]): Promise<void>;
  subscribeState(login: string, cb: (s: ChatState) => void): Unsubscribe;
  saveState(login: string, patch: Record<string, unknown>): void;
  setTyping(roomId: string, login: string, name: string): void;
  subscribeTyping(roomId: string, cb: (t: Typing[]) => void): Unsubscribe;
  /** "I've read this room up to now" — lets the other side show "Seen". */
  setReceipt(roomId: string, login: string): void;
  subscribeReceipts(roomId: string, cb: (marks: Record<string, number>) => void): Unsubscribe;
  heartbeat(login: string, name: string): void;
  subscribePresence(cb: (p: Presence[]) => void): Unsubscribe;
  /** Administrator review: every room, a log of reviews, and recording a new one. */
  subscribeAllRooms(cb: (rooms: ChatRoom[]) => void): Unsubscribe;
  subscribeAudit(cb: (rows: AuditEntry[]) => void): Unsubscribe;
  logReview(entry: AuditEntry): void;
  /** Uploads a file; resolves with its address. */
  uploadFile(roomId: string, msgId: string, file: Blob, name: string, type: string): Promise<string>;
}
