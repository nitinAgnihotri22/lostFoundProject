import { NextResponse } from 'next/server';

const ERR = { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } };
const ok = (schema: unknown, description: string) => ({ description, content: { 'application/json': { schema } } });
const envelope = (data: unknown, extra: Record<string, unknown> = {}) => ({
  type: 'object',
  properties: { success: { type: 'boolean', example: true }, data, ...extra },
});
const idParam = (description: string) => ({ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description });

export async function GET() {
  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'LostFound REST API',
      version: '2.0.0',
      description:
        'Official REST API for LostFound: report lost & found items with geocoded locations, search within a radius, ' +
        'verify ownership with the 3-secret-proofs claim protocol, and message other members in-app.\n\n' +
        '**Authentication:** call `POST /auth/login` (or `POST /auth/register`) to get a `token` valid for 24 hours and send it as ' +
        '`Authorization: Bearer <token>` (click **Authorize**). Browsers receive the same token as the httpOnly `lf_token` cookie. ' +
        'Browsing items (`GET /items`, `GET /items/{id}`) works without a token; everything else requires one.\n\n' +
        '**End-to-end flow:** finder posts a *found* item with photos and 3 verification questions → owner submits a claim answering them → ' +
        'the poster approves one claim (the item becomes `claimed`, other pending claims are auto-rejected) or rejects with a reason → ' +
        'the approved claimant sees the poster’s contact details → either side chats in-app via `/conversations`.',
      contact: { name: 'LostFound Developer Platform', url: 'https://lostfound.community' },
    },
    servers: [{ url: '/api', description: 'Current Environment API Server' }],
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Login / register (Google or email+password) and session management' },
      { name: 'Items', description: 'Report, browse, search and manage lost and found items' },
      { name: 'Uploads', description: 'Photo uploads for item reports' },
      { name: 'Claims', description: '3-proof ownership verification: submit, review, approve/reject' },
      { name: 'Messaging', description: 'In-app conversations between posters and claimants/finders' },
      { name: 'Profile', description: 'The signed-in member’s dashboard data' },
    ],
    paths: {
      // ------------------------------------------------------------------ Auth
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
                  oneOf: [{ $ref: '#/components/schemas/GoogleAuthInput' }, { $ref: '#/components/schemas/EmailLoginInput' }],
                  discriminator: { propertyName: 'provider' },
                },
              },
            },
          },
          responses: {
            '200': ok({ $ref: '#/components/schemas/AuthResponse' }, 'Logged in. Token valid for 24 hours (also set as `lf_token` cookie).'),
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { description: 'Invalid Google session, wrong email/password, or email account that uses Google sign-in', content: ERR },
            '404': { description: 'User does not exist (`code: USER_NOT_FOUND`) – call `/auth/register`', content: ERR },
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
                  oneOf: [{ $ref: '#/components/schemas/GoogleAuthInput' }, { $ref: '#/components/schemas/EmailRegisterInput' }],
                  discriminator: { propertyName: 'provider' },
                },
              },
            },
          },
          responses: {
            '201': ok({ $ref: '#/components/schemas/AuthResponse' }, 'User created and logged in. Token valid for 24 hours.'),
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { description: 'Invalid Google session', content: ERR },
            '409': { description: 'Account already exists (`code: USER_EXISTS`) – call `/auth/login`', content: ERR },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get the currently logged-in user',
          responses: {
            '200': ok(
              { type: 'object', properties: { user: { $ref: '#/components/schemas/User' }, expiresAt: { type: 'integer', example: 1794326400000 } } },
              'Current user and token expiry (epoch ms)'
            ),
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
          responses: { '200': ok({ type: 'object', properties: { ok: { type: 'boolean', example: true } } }, 'Logged out') },
        },
      },

      // ----------------------------------------------------------------- Items
      '/items': {
        get: {
          tags: ['Items'],
          summary: 'Browse active items (public) or list your own',
          description:
            'Without a token: every **active** item, with the poster’s email/phone removed. With a token: adds `myClaim` to items you have claimed, ' +
            'and `excludeMine=1` hides your own posts (what the home screen uses). `mine=1` (token required) returns **your** items in every status, with contact details.',
          security: [],
          parameters: [
            { name: 'mine', in: 'query', schema: { type: 'string', enum: ['1'] }, description: 'Your own items in every status (token required)' },
            { name: 'excludeMine', in: 'query', schema: { type: 'string', enum: ['1'] }, description: 'Hide the caller’s own posts (no effect without a token)' },
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['found', 'lost', 'all'] } },
            { name: 'category', in: 'query', schema: { type: 'string', enum: ['electronics', 'wallets', 'keys', 'bags', 'documents', 'jewelry', 'pets', 'clothing', 'other', 'all'] } },
            { name: 'lat', in: 'query', schema: { type: 'number', format: 'float' }, description: 'Centre latitude for a radius search' },
            { name: 'lng', in: 'query', schema: { type: 'number', format: 'float' }, description: 'Centre longitude for a radius search' },
            { name: 'radiusKm', in: 'query', schema: { type: 'number', default: 5 } },
            { name: 'query', in: 'query', schema: { type: 'string' }, description: 'Free-text search across title, description and address' },
            { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'Lost/found on or after this date' },
          ],
          responses: {
            '200': ok(envelope({ type: 'array', items: { $ref: '#/components/schemas/Item' } }, { count: { type: 'integer' } }), 'Matching items (with `distanceKm` when lat/lng given)'),
            '401': { description: '`mine=1` without a token', content: ERR },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
        post: {
          tags: ['Items'],
          summary: 'Report a found or lost item',
          description:
            'The poster is always the authenticated user. **Found** items need ≥1 photo URL and exactly 3 verification questions; **lost** items need neither. ' +
            'Photos must be URLs (upload files via `POST /uploads` first) – inline base64 is rejected. `occurredAt` cannot be in the future.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateItemInput' } } } },
          responses: {
            '201': ok(envelope({ $ref: '#/components/schemas/Item' }), 'Item report created'),
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },
      '/items/{id}': {
        get: {
          tags: ['Items'],
          summary: 'Item detail, shaped for the viewer',
          description:
            '`viewerRole` tells the client what it is looking at. **owner** gets every claim with proofs; **claimant** gets `myClaim` and, once approved, `posterContact`; ' +
            '**visitor**/**guest** get only `claimCount`. Contact details are never exposed to anyone else.',
          security: [],
          parameters: [idParam('Item id')],
          responses: {
            '200': ok(envelope({ $ref: '#/components/schemas/ItemDetail' }), 'Item detail'),
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
        patch: {
          tags: ['Items'],
          summary: 'Close or reopen your report',
          description: '`resolved` closes the report (item returned / found); `active` reopens a resolved one. A `claimed` item cannot be reopened.',
          parameters: [idParam('Item id')],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['resolved', 'active'] } } } } } },
          responses: {
            '200': ok(envelope({ $ref: '#/components/schemas/Item' }), 'Updated item'),
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { description: 'Not the poster (`code: NOT_ITEM_OWNER`)', content: ERR },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { description: 'Already in that status (`NO_CHANGE`) or item is claimed (`ITEM_CLAIMED`)', content: ERR },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
        delete: {
          tags: ['Items'],
          summary: 'Delete your report',
          description: 'Removes the item together with its claims and conversations.',
          parameters: [idParam('Item id')],
          responses: {
            '200': ok({ type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' } } }, 'Deleted'),
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { description: 'Not the poster (`code: NOT_ITEM_OWNER`)', content: ERR },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },

      // --------------------------------------------------------------- Uploads
      '/uploads': {
        post: {
          tags: ['Uploads'],
          summary: 'Upload an item photo',
          description: 'Multipart upload of one JPEG/PNG/WebP/GIF up to 5 MB. Returns a public URL to put in `images` when creating an item.',
          requestBody: {
            required: true,
            content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } } },
          },
          responses: {
            '201': ok(envelope({ $ref: '#/components/schemas/UploadResult' }), 'Stored'),
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '413': { description: 'File larger than 5 MB', content: ERR },
            '415': { description: 'Not an accepted image type', content: ERR },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },

      // ---------------------------------------------------------------- Claims
      '/claims': {
        get: {
          tags: ['Claims'],
          summary: 'Your claims and the claims on your items',
          description: '`mine` = claims you submitted; `received` = claims other members made on items you posted. Each carries a small `item` summary.',
          parameters: [{ name: 'scope', in: 'query', schema: { type: 'string', enum: ['all', 'mine', 'received'], default: 'all' } }],
          responses: {
            '200': ok(
              envelope(
                { type: 'object', properties: { mine: { type: 'array', items: { $ref: '#/components/schemas/ClaimWithItem' } }, received: { type: 'array', items: { $ref: '#/components/schemas/ClaimWithItem' } } } },
                { count: { type: 'object', properties: { mine: { type: 'integer' }, received: { type: 'integer' } } } }
              ),
              'Claims'
            ),
            '401': { $ref: '#/components/responses/Unauthorized' },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
        post: {
          tags: ['Claims'],
          summary: 'Submit a 3-proof ownership claim',
          description:
            'Answers the item’s 3 verification questions. The claimant is the authenticated user. Rules: only **found** items that are still **active**; ' +
            'not your own item; one claim per member per item (a rejected claim cannot be resubmitted).',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateClaimInput' } } } },
          responses: {
            '201': ok(envelope({ $ref: '#/components/schemas/Claim' }), 'Claim submitted and pending the poster’s review'),
            '400': { description: 'Missing proofs, or the item is a lost item (`code: NOT_CLAIMABLE`)', content: ERR },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { description: 'You posted this item (`code: OWN_ITEM`)', content: ERR },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { description: 'Already claimed by you (`ALREADY_CLAIMED`, `data` = your claim) or item no longer active (`ITEM_CLOSED`)', content: ERR },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },
      '/claims/{id}': {
        patch: {
          tags: ['Claims'],
          summary: 'Approve or reject a claim (poster only)',
          description:
            '**Approve:** the item becomes `claimed`, every other pending claim on it is auto-rejected with reason “Another claim on this item was approved by the poster.”, ' +
            'and the claimant can now see your contact details. **Reject:** `reason` is mandatory and is shown to the claimant.',
          parameters: [idParam('Claim id')],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReviewClaimInput' } } } },
          responses: {
            '200': ok(
              envelope({ $ref: '#/components/schemas/Claim' }, { message: { type: 'string' }, autoRejected: { type: 'integer', description: 'Other pending claims rejected automatically (approve only)' } }),
              'Claim reviewed and saved'
            ),
            '400': { description: 'Bad status, missing `reason` when rejecting, or reason > 300 chars', content: ERR },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { description: 'Not the item’s poster (`code: NOT_ITEM_OWNER`)', content: ERR },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { description: 'Already reviewed (`ALREADY_REVIEWED`) or item not active (`ITEM_CLOSED`)', content: ERR },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },

      // ------------------------------------------------------------- Messaging
      '/conversations': {
        get: {
          tags: ['Messaging'],
          summary: 'List your conversations',
          description: 'Newest activity first, with the other participant, an item summary, the last message and your unread count.',
          responses: {
            '200': ok(envelope({ type: 'array', items: { $ref: '#/components/schemas/Conversation' } }, { count: { type: 'integer' }, unreadTotal: { type: 'integer' } }), 'Conversations'),
            '401': { $ref: '#/components/responses/Unauthorized' },
            '503': { $ref: '#/components/responses/MigrationRequired' },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
        post: {
          tags: ['Messaging'],
          summary: 'Start (or reopen) a conversation about an item',
          description:
            'One conversation exists per item and pair of members; calling again returns the existing one (200). ' +
            'A visitor/claimant messages the poster (`recipientId` optional). The poster must name a `recipientId` who has claimed the item. ' +
            'You cannot message yourself. An optional `message` is sent immediately.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['itemId'],
                  properties: {
                    itemId: { type: 'string' },
                    recipientId: { type: 'string', description: 'Required when you are the poster' },
                    message: { type: 'string', maxLength: 2000, description: 'First message to send' },
                  },
                },
              },
            },
          },
          responses: {
            '200': ok(envelope({ $ref: '#/components/schemas/Conversation' }, { created: { type: 'boolean', example: false } }), 'Existing conversation'),
            '201': ok(envelope({ $ref: '#/components/schemas/Conversation' }, { created: { type: 'boolean', example: true } }), 'Conversation created'),
            '400': { description: 'Missing itemId / recipientId, or self-message (`SELF_MESSAGE`)', content: ERR },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { description: 'Recipient is not a claimant of your item (`NOT_A_CLAIMANT`) or not the poster (`NOT_POSTER`)', content: ERR },
            '404': { $ref: '#/components/responses/NotFound' },
            '503': { $ref: '#/components/responses/MigrationRequired' },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },
      '/conversations/{id}/messages': {
        get: {
          tags: ['Messaging'],
          summary: 'Read a conversation (marks it read)',
          description: 'Only the two participants can read it; anyone else gets 404. Pass `after` (ISO timestamp of your newest message) to poll for new ones.',
          parameters: [idParam('Conversation id'), { name: 'after', in: 'query', schema: { type: 'string', format: 'date-time' } }],
          responses: {
            '200': ok(envelope({ type: 'object', properties: { conversation: { $ref: '#/components/schemas/Conversation' }, messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } } } }), 'Thread'),
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '503': { $ref: '#/components/responses/MigrationRequired' },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
        post: {
          tags: ['Messaging'],
          summary: 'Send a message',
          parameters: [idParam('Conversation id')],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['body'], properties: { body: { type: 'string', minLength: 1, maxLength: 2000 } } } } } },
          responses: {
            '201': ok(envelope({ $ref: '#/components/schemas/Message' }), 'Sent'),
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '503': { $ref: '#/components/responses/MigrationRequired' },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },

      // --------------------------------------------------------------- Profile
      '/profile': {
        get: {
          tags: ['Profile'],
          summary: 'Your dashboard in one call',
          description: 'User, items you posted (every status), claims you made, claims you received, counts and unread messages.',
          responses: {
            '200': ok(envelope({ $ref: '#/components/schemas/ProfileData' }), 'Profile'),
            '401': { $ref: '#/components/responses/Unauthorized' },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },
    },

    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token returned by POST /auth/login or POST /auth/register (valid 24h).' },
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'lf_token', description: 'httpOnly cookie set by login/register in the browser.' },
      },
      responses: {
        Unauthorized: { description: 'Missing, invalid or expired token (`code: UNAUTHENTICATED`)', content: ERR },
        BadRequest: { description: 'Validation failed (`field` names the offending input when known)', content: ERR },
        NotFound: { description: 'Not found – or, for conversations, you are not a participant', content: ERR },
        ServerError: { description: 'Unexpected server or database error', content: ERR },
        MigrationRequired: { description: 'Database schema is behind (`code: MIGRATION_REQUIRED`) – run `supabase/migrations/05_end_to_end.sql`', content: ERR },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false, description: 'Present on non-auth endpoints' },
            error: { type: 'string', example: 'Authentication required.' },
            code: {
              type: 'string',
              description: 'Machine-readable code, when applicable',
              enum: [
                'UNAUTHENTICATED', 'USER_NOT_FOUND', 'USER_EXISTS', 'OWN_ITEM', 'ALREADY_CLAIMED', 'NOT_CLAIMABLE', 'ITEM_CLOSED', 'ITEM_CLAIMED',
                'NOT_ITEM_OWNER', 'ALREADY_REVIEWED', 'NO_CHANGE', 'NOT_A_CLAIMANT', 'NOT_POSTER', 'SELF_MESSAGE', 'MIGRATION_REQUIRED',
              ],
            },
            field: { type: 'string', description: 'Invalid input field (validation errors)' },
            data: { description: 'Extra context, e.g. your existing claim on `ALREADY_CLAIMED`' },
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
        AuthResponse: { type: 'object', properties: { token: { type: 'string', description: 'Bearer token, valid for 24 hours' }, user: { $ref: '#/components/schemas/User' } } },
        GoogleAuthInput: {
          type: 'object',
          required: ['provider', 'accessToken'],
          properties: { provider: { type: 'string', enum: ['google'] }, accessToken: { type: 'string', description: 'Supabase session access_token received after the Google OAuth redirect' } },
        },
        EmailLoginInput: {
          type: 'object',
          required: ['provider', 'email', 'password'],
          properties: { provider: { type: 'string', enum: ['email'] }, email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } },
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
          required: ['lat', 'lng'],
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
            id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['found', 'lost'] },
            title: { type: 'string', example: 'Found Apple iPhone 14 Pro in Black Case' },
            description: { type: 'string' },
            category: { type: 'string', example: 'electronics' },
            images: { type: 'array', items: { type: 'string', format: 'uri' } },
            location: { $ref: '#/components/schemas/GeoLocation' },
            occurredAt: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['active', 'claimed', 'resolved'], description: 'active = open · claimed = a claim was approved · resolved = closed by the poster' },
            userId: { type: 'string', description: 'Poster id' },
            userName: { type: 'string', example: 'Sarah Jenkins' },
            userEmail: { type: 'string', description: 'Poster only (and in `posterContact` for an approved claimant)' },
            userPhone: { type: 'string', description: 'Poster only' },
            reward: { type: 'number' },
            verificationQuestions: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3, description: 'Found items: the 3 questions a claimant must answer' },
            claimCount: { type: 'integer', description: 'Claims received' },
            myClaim: { allOf: [{ $ref: '#/components/schemas/Claim' }], description: 'The caller’s own claim on this item, if any' },
            distanceKm: { type: 'number', description: 'Only on radius searches' },
            createdAt: { type: 'string', format: 'date-time' },
            resolvedAt: { type: 'string', format: 'date-time' },
          },
        },
        ItemDetail: {
          allOf: [
            { $ref: '#/components/schemas/Item' },
            {
              type: 'object',
              properties: {
                viewerRole: { type: 'string', enum: ['owner', 'claimant', 'visitor', 'guest'] },
                claims: { type: 'array', items: { $ref: '#/components/schemas/Claim' }, description: 'Owner only – every claim with its proofs' },
                posterContact: {
                  type: 'object',
                  description: 'Approved claimant only',
                  properties: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' } },
                },
              },
            },
          ],
        },
        CreateItemInput: {
          type: 'object',
          required: ['type', 'title', 'description', 'category', 'location'],
          properties: {
            type: { type: 'string', enum: ['found', 'lost'] },
            title: { type: 'string', minLength: 3, maxLength: 120, example: 'Black Leather Fossil Wallet' },
            description: { type: 'string', minLength: 10, maxLength: 2000, example: 'Found under the table in Blue Bottle Coffee.' },
            category: { type: 'string', enum: ['electronics', 'wallets', 'keys', 'bags', 'documents', 'jewelry', 'pets', 'clothing', 'other'] },
            images: { type: 'array', maxItems: 6, items: { type: 'string', format: 'uri' }, description: 'URLs from POST /uploads (or any https image). Required (≥1) for found items.' },
            location: { $ref: '#/components/schemas/GeoLocation' },
            occurredAt: { type: 'string', format: 'date-time', description: 'Defaults to now; cannot be in the future' },
            verificationQuestions: { type: 'array', items: { type: 'string', minLength: 5, maxLength: 200 }, minItems: 3, maxItems: 3, description: 'Required for found items' },
            reward: { type: 'number', minimum: 0 },
            userPhone: { type: 'string', description: 'Contact phone for this report (defaults to your profile phone)' },
          },
        },
        Claim: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            itemId: { type: 'string' },
            itemTitle: { type: 'string' },
            claimantId: { type: 'string' },
            claimantName: { type: 'string', example: 'Michael Chang' },
            claimantEmail: { type: 'string' },
            claimantPhone: { type: 'string' },
            proof1: { type: 'string' },
            proof2: { type: 'string' },
            proof3: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
            finderNotes: { type: 'string', description: 'Poster’s optional note when approving' },
            rejectionReason: { type: 'string', description: 'Poster’s reason – present when rejected', example: 'Proofs do not match the item' },
            reviewedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ItemSummary: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            type: { type: 'string', enum: ['found', 'lost'] },
            status: { type: 'string', enum: ['active', 'claimed', 'resolved'] },
            image: { type: 'string', format: 'uri' },
            posterId: { type: 'string' },
            posterName: { type: 'string' },
          },
        },
        ClaimWithItem: { allOf: [{ $ref: '#/components/schemas/Claim' }, { type: 'object', properties: { item: { $ref: '#/components/schemas/ItemSummary' } } }] },
        CreateClaimInput: {
          type: 'object',
          required: ['itemId', 'proof1', 'proof2', 'proof3'],
          properties: {
            itemId: { type: 'string' },
            proof1: { type: 'string', maxLength: 500, description: 'Answer to verification question 1' },
            proof2: { type: 'string', maxLength: 500, description: 'Answer to verification question 2' },
            proof3: { type: 'string', maxLength: 500, description: 'Answer to verification question 3' },
            phone: { type: 'string', description: 'Contact phone to release to the poster on approval (defaults to your profile phone)' },
          },
        },
        ReviewClaimInput: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['approved', 'rejected'] },
            reason: { type: 'string', maxLength: 300, description: 'Required when rejecting; optional note when approving', example: 'Proofs do not match the item' },
          },
        },
        UploadResult: {
          type: 'object',
          properties: { url: { type: 'string', format: 'uri' }, path: { type: 'string' }, size: { type: 'integer' }, contentType: { type: 'string' } },
        },
        Conversation: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            itemId: { type: 'string' },
            item: { $ref: '#/components/schemas/ItemSummary' },
            participant: { type: 'object', description: 'The other member', properties: { id: { type: 'string' }, name: { type: 'string' }, avatar: { type: 'string' } } },
            lastMessageAt: { type: 'string', format: 'date-time' },
            lastMessagePreview: { type: 'string' },
            lastSenderId: { type: 'string' },
            unreadCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            conversationId: { type: 'string' },
            senderId: { type: 'string' },
            body: { type: 'string' },
            readAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ProfileStats: {
          type: 'object',
          properties: {
            posted: { type: 'integer' }, postedFound: { type: 'integer' }, postedLost: { type: 'integer' },
            returned: { type: 'integer', description: 'Your posts that are claimed or resolved' },
            claimsMade: { type: 'integer' }, claimsApproved: { type: 'integer' }, claimsPending: { type: 'integer' }, claimsRejected: { type: 'integer' },
            claimsReceived: { type: 'integer' }, claimsReceivedPending: { type: 'integer' },
            unreadMessages: { type: 'integer' },
          },
        },
        ProfileData: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/User' },
            stats: { $ref: '#/components/schemas/ProfileStats' },
            postedItems: { type: 'array', items: { $ref: '#/components/schemas/Item' } },
            myClaims: { type: 'array', items: { $ref: '#/components/schemas/ClaimWithItem' } },
            receivedClaims: { type: 'array', items: { $ref: '#/components/schemas/ClaimWithItem' } },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec);
}
