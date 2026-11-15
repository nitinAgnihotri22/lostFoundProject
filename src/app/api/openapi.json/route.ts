import { NextResponse } from 'next/server';

export async function GET() {
  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'LostFound REST API',
      version: '1.1.0',
      description:
        'Official REST API for LostFound: Report lost & found items with geocode coordinates, perform 5km radius spatial queries, and verify ownership via the 3-Secret-Proofs claim protocol.\n\n' +
        '**Authentication:** call `POST /auth/login` (or `POST /auth/register`) to get a `token` valid for 24 hours. ' +
        'Send it as `Authorization: Bearer <token>` on every other endpoint (click **Authorize** above). ' +
        'Browsers also receive it as the httpOnly `lf_token` cookie.',
      contact: {
        name: 'LostFound Developer Platform',
        url: 'https://lostfound.community',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'Current Environment API Server',
      },
    ],
    // Every endpoint requires the login token unless it overrides with `security: []`.
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    tags: [
      {
        name: 'Auth',
        description: 'Login / register (Google or email+password) and session management',
      },
      {
        name: 'Items',
        description: 'Report, search, and manage lost and found items',
      },
      {
        name: 'Claims',
        description: '3-Proof ownership verification and claim management',
      },
      {
        name: 'Geocode',
        description: 'Geospatial search and reverse geocoding services',
      },
    ],
    paths: {
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Log in an existing user',
          description:
            'Google: send the Supabase `access_token` from the Google OAuth callback; the server verifies it. ' +
            'Email: send email + password. Returns 404 `USER_NOT_FOUND` if no account exists – the client should then call `/auth/register`.',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/GoogleAuthInput' },
                    { $ref: '#/components/schemas/EmailLoginInput' },
                  ],
                  discriminator: { propertyName: 'provider' },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Logged in. Token valid for 24 hours (also set as `lf_token` cookie).',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': {
              description:
                'Invalid Google session, wrong email/password, or email account that uses Google sign-in',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'User does not exist (`code: USER_NOT_FOUND`) – call `/auth/register`',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user',
          description:
            'Google: creates the user with `role_source=google`, `role_type=social` and no password. ' +
            'Email: creates the user with `role_source=normal_register`, `role_type=email` (password min 8 chars). ' +
            'Returns 409 `USER_EXISTS` if the account already exists – the client should then call `/auth/login`.',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/GoogleAuthInput' },
                    { $ref: '#/components/schemas/EmailRegisterInput' },
                  ],
                  discriminator: { propertyName: 'provider' },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'User created and logged in. Token valid for 24 hours.',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { description: 'Invalid Google session', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '409': {
              description: 'Account already exists (`code: USER_EXISTS`) – call `/auth/login`',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get the currently logged-in user',
          responses: {
            '200': {
              description: 'Current user and token expiry (epoch ms)',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      user: { $ref: '#/components/schemas/User' },
                      expiresAt: { type: 'integer', example: 1794326400000 },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Log out (clears the `lf_token` cookie)',
          description: 'Bearer-token API clients should also discard their stored token.',
          security: [],
          responses: {
            '200': {
              description: 'Logged out',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { ok: { type: 'boolean', example: true } } },
                },
              },
            },
          },
        },
      },
      '/items': {
        get: {
          tags: ['Items'],
          summary: 'List and search items within radius',
          description:
            'Retrieve items filtered by category, type (found/lost), keyword, date range, or geospatial radius (default 5 km).',
          parameters: [
            {
              name: 'type',
              in: 'query',
              description: 'Filter by item type',
              required: false,
              schema: {
                type: 'string',
                enum: ['found', 'lost', 'all'],
                default: 'found',
              },
            },
            {
              name: 'category',
              in: 'query',
              description: 'Filter by item category',
              required: false,
              schema: {
                type: 'string',
                enum: [
                  'electronics',
                  'wallets',
                  'keys',
                  'bags',
                  'documents',
                  'jewelry',
                  'pets',
                  'clothing',
                  'other',
                  'all',
                ],
              },
            },
            {
              name: 'lat',
              in: 'query',
              description: 'Center latitude for radius query (e.g. 37.7749)',
              required: false,
              schema: {
                type: 'number',
                format: 'float',
              },
            },
            {
              name: 'lng',
              in: 'query',
              description: 'Center longitude for radius query (e.g. -122.4194)',
              required: false,
              schema: {
                type: 'number',
                format: 'float',
              },
            },
            {
              name: 'radiusKm',
              in: 'query',
              description: 'Radius distance in kilometers (default 5 km)',
              required: false,
              schema: {
                type: 'number',
                default: 5,
              },
            },
            {
              name: 'query',
              in: 'query',
              description: 'Free-text search across title, description, and address',
              required: false,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'startDate',
              in: 'query',
              description: 'Filter items lost/found on or after this ISO date',
              required: false,
              schema: {
                type: 'string',
                format: 'date-time',
              },
            },
          ],
          responses: {
            '401': { $ref: '#/components/responses/Unauthorized' },
            '200': {
              description: 'List of matching items with distance calculations',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      count: { type: 'integer' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Item' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Items'],
          summary: 'Report a found or lost item',
          description:
            'Submit a new item report. Photos are mandatory for found items and optional for lost items. Includes 3 secret verification questions for finders. The reporter (userId/userName/userEmail) is taken from the auth token.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateItemInput' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Item report created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { $ref: '#/components/schemas/Item' },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Validation failed (e.g. missing required fields or photos for found item)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },
      '/items/{id}': {
        get: {
          tags: ['Items'],
          summary: 'Get item details by ID',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'The unique item ID',
            },
          ],
          responses: {
            '200': {
              description: 'Item details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { $ref: '#/components/schemas/Item' },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { description: 'Item not found' },
          },
        },
      },
      '/claims': {
        get: {
          tags: ['Claims'],
          summary: 'List claims for verification review',
          description:
            'Returns claims made by the authenticated user, plus claims on items the authenticated user reported.',
          responses: {
            '401': { $ref: '#/components/responses/Unauthorized' },
            '500': { $ref: '#/components/responses/ServerError' },
            '200': {
              description: 'List of submitted claims',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      count: { type: 'integer' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Claim' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Claims'],
          summary: 'Submit a 3-Proof ownership claim',
          description:
            'Submit a claim on a found item by providing answers to the 3 private verification questions that only the true owner would know. The claimant (id/name/email) is taken from the auth token. Users cannot claim items they posted themselves, and can claim each item only once (a rejected claim cannot be resubmitted).',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateClaimInput' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Claim submitted and pending finder review',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { $ref: '#/components/schemas/Claim' },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'All 3 verification proofs are required',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': {
              description: 'You cannot claim an item that you posted (`code: OWN_ITEM`)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '409': {
              description:
                'You have already claimed this item (`code: ALREADY_CLAIMED`). `data` holds your existing claim, including its status and any rejection reason.',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/Error' },
                      { type: 'object', properties: { data: { $ref: '#/components/schemas/Claim' } } },
                    ],
                  },
                },
              },
            },
            '404': {
              description: 'Item not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },
      '/claims/{id}': {
        patch: {
          tags: ['Claims'],
          summary: 'Approve or reject a claim',
          description:
            'Finder reviews claimant proofs and either approves (releasing private contact information) or rejects the claim with a mandatory reason.',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['approved', 'rejected'],
                    },
                    reason: {
                      type: 'string',
                      maxLength: 300,
                      description:
                        'Why the claim is being rejected – **required when `status` is `rejected`**. Shown to the claimant. Optional note when approving.',
                      example: 'Proofs do not match the item',
                    },
                    notes: {
                      type: 'string',
                      deprecated: true,
                      description: 'Legacy alias for `reason`',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Claim status updated and saved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Claim claim-123 status updated to rejected' },
                      data: { $ref: '#/components/schemas/Claim' },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Status must be "approved" or "rejected", `reason` missing when rejecting, reason too long, or invalid JSON',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': {
              description: 'Only the person who posted the item can review its claims (`code: NOT_ITEM_OWNER`)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'Claim not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '409': {
              description: 'Claim was already approved or rejected (`code: ALREADY_REVIEWED`)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token returned by POST /auth/login or POST /auth/register (valid 24h).',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'lf_token',
          description: 'httpOnly cookie set by login/register in the browser.',
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing, invalid or expired token',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        ServerError: {
          description: 'Unexpected server or database error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        BadRequest: {
          description: 'Validation failed',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
              description: 'Present on Items/Claims endpoints; omitted on Auth endpoints',
            },
            error: { type: 'string', example: 'Authentication required.' },
            code: {
              type: 'string',
              enum: ['USER_NOT_FOUND', 'USER_EXISTS', 'OWN_ITEM', 'ALREADY_CLAIMED', 'NOT_ITEM_OWNER', 'ALREADY_REVIEWED'],
              description: 'Machine-readable error code, when applicable',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Sarah Jenkins' },
            email: { type: 'string', format: 'email', example: 'sarah.j@example.com' },
            phone: { type: 'string', example: '+1 (555) 234-5678' },
            avatar: { type: 'string', format: 'uri' },
            roleSource: { type: 'string', enum: ['google', 'normal_register'] },
            roleType: { type: 'string', enum: ['social', 'email'] },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'Bearer token, valid for 24 hours' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        GoogleAuthInput: {
          type: 'object',
          required: ['provider', 'accessToken'],
          properties: {
            provider: { type: 'string', enum: ['google'] },
            accessToken: {
              type: 'string',
              description: 'Supabase session access_token received after the Google OAuth redirect',
            },
          },
        },
        EmailLoginInput: {
          type: 'object',
          required: ['provider', 'email', 'password'],
          properties: {
            provider: { type: 'string', enum: ['email'] },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
          },
        },
        EmailRegisterInput: {
          type: 'object',
          required: ['provider', 'name', 'email', 'password'],
          properties: {
            provider: { type: 'string', enum: ['email'] },
            name: { type: 'string', example: 'Sarah Jenkins' },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password', minLength: 8 },
            phone: { type: 'string' },
          },
        },
        GeoLocation: {
          type: 'object',
          required: ['lat', 'lng', 'address'],
          properties: {
            lat: { type: 'number', example: 37.7749 },
            lng: { type: 'number', example: -122.4194 },
            address: { type: 'string', example: 'Civic Center Plaza, San Francisco, CA' },
            city: { type: 'string', example: 'San Francisco' },
          },
        },
        Item: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'item-1' },
            type: { type: 'string', enum: ['found', 'lost'], example: 'found' },
            title: { type: 'string', example: 'Found Apple iPhone 14 Pro in Black Case' },
            description: { type: 'string', example: 'Found on park bench near central fountain.' },
            category: { type: 'string', example: 'electronics' },
            images: {
              type: 'array',
              items: { type: 'string' },
              example: ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab'],
            },
            location: { $ref: '#/components/schemas/GeoLocation' },
            occurredAt: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['active', 'claimed', 'resolved'], example: 'active' },
            userId: { type: 'string' },
            userName: { type: 'string', example: 'Sarah Jenkins' },
            userEmail: { type: 'string', example: 'sarah.j@example.com' },
            userPhone: { type: 'string', example: '+1 (555) 234-5678' },
            verificationQuestions: {
              type: 'array',
              items: { type: 'string' },
              example: [
                'What wallpaper is on the lock screen?',
                'What case brand?',
                'Any cards tucked inside?',
              ],
            },
            distanceKm: {
              type: 'number',
              description: 'Calculated distance from search coordinates',
              example: 1.4,
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateItemInput: {
          type: 'object',
          required: ['type', 'title', 'description', 'category', 'location', 'occurredAt'],
          properties: {
            type: { type: 'string', enum: ['found', 'lost'] },
            title: { type: 'string', example: 'Black Leather Fossil Wallet' },
            description: { type: 'string', example: 'Found under the table in Blue Bottle Coffee.' },
            category: {
              type: 'string',
              enum: [
                'electronics',
                'wallets',
                'keys',
                'bags',
                'documents',
                'jewelry',
                'pets',
                'clothing',
                'other',
              ],
            },
            images: {
              type: 'array',
              items: { type: 'string' },
              description: 'Mandatory for found items, optional for lost items',
            },
            location: { $ref: '#/components/schemas/GeoLocation' },
            occurredAt: { type: 'string', format: 'date-time' },
            verificationQuestions: {
              type: 'array',
              items: { type: 'string' },
              description: '3 private questions configured by the finder',
            },
          },
        },
        Claim: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'claim-123' },
            itemId: { type: 'string', example: 'item-1' },
            itemTitle: { type: 'string', example: 'Brown Leather Bifold Wallet' },
            claimantId: { type: 'string' },
            claimantName: { type: 'string', example: 'Michael Chang' },
            claimantEmail: { type: 'string', example: 'michael.c@example.com' },
            claimantPhone: { type: 'string', example: '+1 (555) 432-8765' },
            proof1: { type: 'string', example: 'Initials MC stamped in inner corner' },
            proof2: { type: 'string', example: 'Caltrain GoPass with number ending 8812' },
            proof3: { type: 'string', example: 'Silver key tucked behind credit card sleeve' },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'pending' },
            finderNotes: {
              type: 'string',
              description: "Poster's optional note when approving",
            },
            rejectionReason: {
              type: 'string',
              description: "Poster's reason – present when `status` is `rejected`",
              example: 'Proofs do not match the item',
            },
            reviewedAt: {
              type: 'string',
              format: 'date-time',
              description: 'When the poster approved or rejected the claim',
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateClaimInput: {
          type: 'object',
          required: ['itemId', 'proof1', 'proof2', 'proof3'],
          properties: {
            itemId: { type: 'string', example: 'item-1' },
            proof1: {
              type: 'string',
              description: 'Proof 1: Unique marking, exterior detail or scratch',
            },
            proof2: {
              type: 'string',
              description: 'Proof 2: Hidden content, interior card, or specific tag',
            },
            proof3: {
              type: 'string',
              description: 'Proof 3: Secret verification detail, lock screen, or serial number',
            },
            phone: { type: 'string', example: '+1 (555) 987-6543' },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec);
}

