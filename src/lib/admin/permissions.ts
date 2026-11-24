// Admin roles and what each may do. Shared by the API (enforcement) and the
// admin UI (hiding what the role can't use) – keep it free of server imports.

export type AdminRole = 'super_admin' | 'sub_admin' | 'checker';

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: 'Super admin',
  sub_admin: 'Sub admin',
  checker: 'Checker',
};

/** Roles a super admin can give to other admins. */
export const ASSIGNABLE_ROLES: AdminRole[] = ['sub_admin', 'checker'];

const ALL: AdminRole[] = ['super_admin', 'sub_admin', 'checker'];
const BOTH: AdminRole[] = ['super_admin', 'sub_admin'];
const SUPER: AdminRole[] = ['super_admin'];
/** Maker-checker: only these roles may approve or reject new posts. */
const REVIEWERS: AdminRole[] = ['super_admin', 'checker'];

export const PERMISSIONS = {
  'dashboard.view': ALL,
  'posts.view': ALL,
  'posts.review': REVIEWERS, // approve / reject posts waiting for review
  'posts.moderate': BOTH, // hide / restore a post
  'posts.delete': SUPER, // permanent delete
  'users.view': BOTH,
  'users.moderate': BOTH, // disable / enable a website user
  'users.create': SUPER, // create website users
  'messages.view': BOTH,
  'messages.manage': BOTH,
  'admins.manage': SUPER, // create / disable / reset sub admins
  'pages.manage': SUPER, // static pages + company details
  'audit.view': SUPER,
  'analytics.view': BOTH, // traffic, conversions and the ads A/B test
  'ads.manage': SUPER, // AdSense + Google Analytics settings
  'boosts.view': ALL, // paid boosts (free during launch)
  'boosts.review': REVIEWERS, // approve / reject a person's first boost
  'boosts.manage': BOTH, // stop a running boost, run background jobs
} as const satisfies Record<string, AdminRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export const can = (role: AdminRole | undefined | null, perm: Permission) =>
  !!role && (PERMISSIONS[perm] as readonly AdminRole[]).includes(role);

/** Public shape of an admin account (never includes the password hash). */
export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: 'active' | 'disabled';
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  createdBy: string | null;
}

export const PASSWORD_MIN = 10;

/** Admin passwords: 10+ chars with at least one letter and one number. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (pw.length > 200) return 'Password is too long.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain at least one letter and one number.';
  return null;
}
