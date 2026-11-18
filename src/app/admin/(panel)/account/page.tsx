import type { Metadata } from 'next';
import AccountView from '@/components/admin/AccountView';

export const metadata: Metadata = { title: 'My account' };

// Open to every signed-in admin (the layout already checked the session),
// including one who still has to replace a temporary password.
export default function AdminAccountPage() {
  return <AccountView />;
}
