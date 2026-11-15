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
  status: 'active' | 'claimed' | 'resolved';
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  reward?: number;
  // Optional custom verification prompts set by the finder
  verificationQuestions?: [string, string, string];
  createdAt: string;
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

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  roleSource?: 'google' | 'normal_register';
  roleType?: 'social' | 'email';
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

