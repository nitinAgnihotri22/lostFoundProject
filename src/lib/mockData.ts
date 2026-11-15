import { Item } from '@/types';

export const INITIAL_ITEMS: Item[] = [
  {
    id: 'item-1',
    type: 'found',
    title: 'Found Apple iPhone 14 Pro in Black Case',
    description: 'Found on a park bench near the central fountain. The phone has a matte black protective case with a distinctive kickstand. Screen was locked with 45% battery remaining.',
    category: 'electronics',
    images: [
      'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800&auto=format&fit=crop&q=80'
    ],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      address: 'Civic Center Plaza, San Francisco, CA',
      city: 'San Francisco'
    },
    occurredAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    status: 'active',
    userId: 'user-2',
    userName: 'Sarah Jenkins',
    userEmail: 'sarah.j@example.com',
    userPhone: '+1 (555) 234-5678',
    verificationQuestions: [
      'What picture is set as the lock screen wallpaper?',
      'What brand is the matte black phone case?',
      'Are there any cards or stickers tucked into the phone case?'
    ],
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
  },
  {
    id: 'item-2',
    type: 'found',
    title: 'Brown Leather Bifold Wallet',
    description: 'Found under a dining table at Blue Bottle Coffee. Contains multiple membership cards and cash. Kept safe with the cafe manager.',
    category: 'wallets',
    images: [
      'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80'
    ],
    location: {
      lat: 37.7858,
      lng: -122.4065,
      address: '66 Mint St, San Francisco, CA 94103',
      city: 'San Francisco'
    },
    occurredAt: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
    status: 'active',
    userId: 'user-3',
    userName: 'Alex Wong',
    userEmail: 'alex.w@example.com',
    verificationQuestions: [
      'What brand is stamped on the outer leather?',
      'What initials or name appears on the transit card inside?',
      'What color is the inner stitch threading?'
    ],
    createdAt: new Date(Date.now() - 7 * 3600 * 1000).toISOString()
  },
  {
    id: 'item-3',
    type: 'found',
    title: 'Set of 4 Keys with Car Key Fob & Blue Lanyard',
    description: 'Found hanging on the fence near the dog park entrance. Has a Subaru fob, house keys, and a miniature swiss army knife.',
    category: 'keys',
    images: [
      'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=800&auto=format&fit=crop&q=80'
    ],
    location: {
      lat: 37.7694,
      lng: -122.4467,
      address: 'Buena Vista Park, SF, CA',
      city: 'San Francisco'
    },
    occurredAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    status: 'active',
    userId: 'user-4',
    userName: 'Marcus Rivera',
    userEmail: 'marcus.r@example.com',
    verificationQuestions: [
      'What car model/year is the fob for?',
      'What text is printed along the blue lanyard?',
      'What color is the small swiss army knife attached?'
    ],
    createdAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString()
  },
  {
    id: 'item-4',
    type: 'found',
    title: 'North Face Backpack with Laptop',
    description: 'Left on the BART train approaching Montgomery Station. Handed in to station agent, cataloging here to help owner connect immediately.',
    category: 'bags',
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80'
    ],
    location: {
      lat: 37.7892,
      lng: -122.4014,
      address: 'Montgomery BART Station, SF, CA',
      city: 'San Francisco'
    },
    occurredAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    status: 'active',
    userId: 'user-5',
    userName: 'Transit Volunteer',
    userEmail: 'sf.transit.lost@example.org',
    verificationQuestions: [
      'What brand and screen size is the laptop inside?',
      'What notebook or book title is in the front pocket?',
      'What specific keychain is on the zipper pull?'
    ],
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'item-5',
    type: 'lost',
    title: 'LOST: Golden Retriever Mix "Charlie"',
    description: 'Charlie slipped his collar near Mission Dolores Park yesterday evening. He is microchipped, very friendly, and responds to treats. $500 reward for safe return.',
    category: 'pets',
    images: [
      'https://images.unsplash.com/photo-1552053831-71594a27632d?w=800&auto=format&fit=crop&q=80'
    ],
    location: {
      lat: 37.7596,
      lng: -122.4269,
      address: 'Dolores Park, San Francisco, CA',
      city: 'San Francisco'
    },
    occurredAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    status: 'active',
    userId: 'user-1',
    userName: 'Elena Rostova',
    userEmail: 'elena.rostova@example.com',
    userPhone: '+1 (555) 987-6543',
    reward: 500,
    createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString()
  }
];

