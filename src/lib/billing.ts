// Orders and plans (server only).
// -------------------------------------------------------------------
// While PAYMENTS_ENABLED is false every order is completed straight away
// as a 'free' payment (amount = list price, charged = 0), so history and
// reports look the same as they will once payments are switched on.
//
// To add payments later: make startOrder() create a provider order
// (Razorpay/Stripe) and return { status: 'created', checkout }, then add
// /api/payments/webhook that marks the payment 'paid' and runs the same
// activation (activateBoost / activatePremium). Nothing else changes.
// -------------------------------------------------------------------
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/db';
import { PAYMENTS_ENABLED, PLAN_LIMITS, type PlanId, type PlanLimits } from '@/lib/plans';

export interface OrderResult {
  paymentId: string;
  /** 'free' = done, activate now. 'created' = waiting for the provider (future). */
  status: 'free' | 'created';
}

export async function startOrder(userId: string, product: string, listPricePaise: number): Promise<OrderResult> {
  if (PAYMENTS_ENABLED) {
    // Placeholder for the provider integration. Refuse rather than give things away silently.
    throw Object.assign(new Error('Payments are enabled but no payment provider is set up yet.'), { status: 503, code: 'PAYMENTS_NOT_CONFIGURED' });
  }
  const id = crypto.randomUUID();
  const { error } = await supabaseAdmin.from('payments').insert({
    id,
    user_id: userId,
    product,
    amount_paise: listPricePaise,
    charged_paise: 0,
    provider: 'free_launch',
    status: 'free',
  });
  if (error) throw error;
  return { paymentId: id, status: 'free' };
}

export interface PlanInfo {
  plan: PlanId;
  limits: PlanLimits;
  subscription: { id: string; since: string; periodEnd: string | null; source: string } | null;
}

/** The user's current plan. Falls back to Free if the tables aren't there yet. */
export async function getPlan(userId: string): Promise<PlanInfo> {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id, created_at, current_period_end, source')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);
  const row = !error ? (data ?? [])[0] : null;
  const live = row && (!row.current_period_end || new Date(row.current_period_end).getTime() > Date.now());
  if (!live) return { plan: 'free', limits: PLAN_LIMITS.free, subscription: null };
  return {
    plan: 'premium',
    limits: PLAN_LIMITS.premium,
    subscription: { id: row.id, since: row.created_at, periodEnd: row.current_period_end, source: row.source },
  };
}

/** Plans for many users at once (matching jobs). Users without a live subscription are 'free'. */
export async function getPlans(userIds: string[]): Promise<Map<string, PlanId>> {
  const out = new Map<string, PlanId>(userIds.map((id) => [id, 'free']));
  if (!userIds.length) return out;
  const { data } = await supabaseAdmin.from('subscriptions').select('user_id, current_period_end').in('user_id', userIds).eq('status', 'active');
  for (const r of data ?? []) {
    if (!r.current_period_end || new Date(r.current_period_end).getTime() > Date.now()) out.set(String(r.user_id), 'premium');
  }
  return out;
}

/** Start Premium. Free during launch: no end date until payments exist. */
export async function activatePremium(userId: string): Promise<PlanInfo> {
  const current = await getPlan(userId);
  if (current.plan === 'premium') return current;
  const order = await startOrder(userId, 'premium_free_launch', 0);
  const { error } = await supabaseAdmin.from('subscriptions').insert({
    id: crypto.randomUUID(),
    user_id: userId,
    plan: 'premium',
    status: 'active',
    source: 'free_launch',
    current_period_end: null,
    payment_id: order.paymentId,
  });
  if (error) throw error;
  return getPlan(userId);
}

export async function cancelPremium(userId: string): Promise<PlanInfo> {
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw error;
  return getPlan(userId);
}
