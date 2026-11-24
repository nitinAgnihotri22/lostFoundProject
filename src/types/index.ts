export type ItemType = 'found' | 'lost';

export type Category =
  | 'electronics'
  | 'wallets'
  | 'keys'
  | 'bags'
  | 'documents'
  | 'jewelry'
  | 'pets'
  | 'clothing'
  | 'other';

export interface GeoLocation {
  lat: number;
  lng: number;
  address: string;
  city?: string;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  description: string;
  category: Category;
  images: string[];
  location: GeoLocation;
  occurredAt: string; // ISO string
  /** active = open; claimed = a claim was approved; resolved = closed by the poster */
  status: 'active' | 'claimed' | 'resolved';
  userId: string;
  userName: string;
  /** Poster contact – only present for the poster and an approved claimant. */
  userEmail?: string;
  userPhone?: string;
  reward?: number;
  // Optional custom verification prompts set by the finder
  verificationQuestions?: [string, string, string];
  createdAt: string;
  resolvedAt?: string;
  /** Number of claims received (filled in by the API). */
  claimCount?: number;
  /** The viewer's own claim on this item, if any (filled in by the API). */
  myClaim?: Claim;
  /** Removed from the website by an admin (only the poster still sees it). */
  hiddenByAdmin?: boolean;
  hiddenReason?: string;
  /** Maker-checker review: only 'approved' posts are public. Missing = approved (pre-migration rows). */
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  /** Why the reviewer rejected the post (shown to the poster). */
  reviewNote?: string;
  /** Pinned to the top with a "Boosted" label until this time (paid boost, free during launch). */
  boostedUntil?: string;
}

/** GET /api/items/{id} – item plus what the viewer is allowed to see. */
export interface ItemDetail extends Item {
  viewerRole: 'owner' | 'claimant' | 'visitor' | 'guest';
  /** Every claim on the item – owner only. */
  claims?: Claim[];
  /** Poster's contact – approved claimant only. */
  posterContact?: { name: string; email?: string; phone?: string };
}

export interface Claim {
  id: string;
  itemId: string;
  itemTitle: string;
  claimantId: string;
  claimantName: string;
  claimantEmail: string;
  claimantPhone: string;
  proof1: string;
  proof2: string;
  proof3: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  finderNotes?: string;
  /** Poster's reason – set when status is 'rejected'. */
  rejectionReason?: string;
  /** When the poster approved/rejected the claim. */
  reviewedAt?: string;
}

export interface ItemSummary {
  id: string;
  title: string;
  type: ItemType;
  status: Item['status'];
  image?: string;
  posterId: string;
  posterName?: string;
}

export interface ClaimWithItem extends Claim {
  item?: ItemSummary;
}

export interface User {
  id: string;
  name: string;
  /** Optional: phone-OTP accounts may not have one. */
  email?: string;
  phone?: string;
  avatar?: string;
  roleSource?: 'google' | 'normal_register' | 'phone';
  roleType?: 'social' | 'email' | 'phone';
  /** 'premium' when the user has an active Premium plan. */
  plan?: 'free' | 'premium';
}

export interface ConversationParticipant {
  id: string;
  name: string;
  avatar?: string;
}

export interface Conversation {
  id: string;
  itemId: string;
  item?: ItemSummary;
  /** The other person in the conversation. */
  participant: ConversationParticipant;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastSenderId?: string;
  unreadCount: number;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt?: string;
  createdAt: string;
}

export interface ProfileStats {
  posted: number;
  postedFound: number;
  postedLost: number;
  returned: number;
  claimsMade: number;
  claimsApproved: number;
  claimsPending: number;
  claimsRejected: number;
  claimsReceived: number;
  claimsReceivedPending: number;
  unreadMessages: number;
}

export interface ProfileData {
  user: User;
  stats: ProfileStats;
  postedItems: Item[];
  myClaims: ClaimWithItem[];
  receivedClaims: ClaimWithItem[];
}

export interface FilterState {
  searchQuery: string;
  category: string;
  type: ItemType | 'all';
  radiusKm: number;
  centerLocation: GeoLocation | null;
  startDate?: string;
  endDate?: string;
}

// -------------------------------------------------------------------
// Boosts, alerts and Premium (Phase 2 + 3 of the monetization plan)
// -------------------------------------------------------------------
export interface Boost {
  id: string;
  itemId: string;
  package: 'local' | 'area' | 'city';
  radiusKm: number;
  status: 'pending_review' | 'active' | 'completed' | 'cancelled' | 'rejected';
  reviewNote?: string;
  startsAt?: string;
  endsAt?: string;
  roundsTotal: number;
  roundsSent: number;
  nextRoundAt?: string;
  /** People alerted so far. */
  recipientsCount: number;
  /** Item views while the boost ran. */
  viewsCount: number;
  /** New conversations about the item since the boost started. */
  messagesCount?: number;
  createdAt: string;
}

export interface SavedSearch {
  id: string;
  label: string;
  category: Category | null;
  keywords: string;
  location: GeoLocation;
  radiusKm: number;
  lostOn: string | null;
  active: boolean;
  createdAt: string;
  matchCount?: number;
}

export interface MatchSummary {
  id: string;
  savedSearchId: string;
  score: number;
  createdAt: string;
  item: Pick<Item, 'id' | 'title' | 'category' | 'images' | 'occurredAt' | 'status'> & { address: string; distanceKm: number };
}

export interface AppNotification {
  id: string;
  kind: 'boost_alert' | 'match' | 'match_digest' | 'boost_update';
  title: string;
  body: string;
  url?: string;
  itemId?: string;
  read: boolean;
  createdAt: string;
}
