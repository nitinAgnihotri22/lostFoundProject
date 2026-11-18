// Admin roles and what each may do. Shared by the API (enforcement) and the
// admin UI (hiding what the role can't use) – keep it free of server imports.

export type AdminRole = 'super_admin' | 'sub_admin';

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: 'Super admin',
  sub_admin: 'Sub admin',
};

const BOTH: AdminRole[] = ['super_admin', 'sub_admin'];
const SUPER: AdminRole[] = ['super_admin'];

export const PERMISSIONS = {
  'dashboard.view': BOTH,
  'posts.view': BOTH,
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
