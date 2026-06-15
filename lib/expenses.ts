import { supabase } from "./supabase";
import type { AddExpenseInput, DebtRecord, Expense, ExpenseSplit } from "../types/expense";

// ─── Add expense + splits ────────────────────────────────────────────────────

export async function addExpense(tripId: string, input: AddExpenseInput): Promise<Expense> {
  const { title, amount, paid_by, expense_date, split_member_ids } = input;

  if (split_member_ids.length === 0) throw new Error("At least one member must be in the split.");

  const share = Math.round((amount / split_member_ids.length) * 100) / 100;

  // 1. Insert expense
  const { data: expense, error: expErr } = await (supabase as any)
    .from("expenses")
    .insert({ trip_id: tripId, paid_by, title, amount, currency: "THB", expense_date })
    .select()
    .single();
  if (expErr) throw expErr;

  // 2. Insert splits — payer's own split is included but flagged via settled=false like others
  //    (payer doesn't owe themselves — we handle this in settlement calculation, not at insert time)
  const splits = split_member_ids.map((member_id) => ({
    expense_id: expense.id,
    member_id,
    share_amount: share,
    settled: member_id === paid_by, // payer's share is pre-settled
  }));

  const { error: splitErr } = await (supabase as any).from("expense_splits").insert(splits);
  if (splitErr) throw splitErr;

  return expense as Expense;
}

// ─── Get all expenses for a trip (with payer name + splits) ─────────────────

export async function getExpensesByTrip(tripId: string): Promise<Expense[]> {
  const { data, error } = await (supabase as any)
    .from("expenses")
    .select(`
      *,
      payer:trip_members!expenses_paid_by_fkey(display_name),
      splits:expense_splits(
        id, member_id, share_amount, settled,
        member:trip_members!expense_splits_member_id_fkey(display_name)
      )
    `)
    .eq("trip_id", tripId)
    .order("expense_date", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    payer_name: row.payer?.display_name ?? null,
    splits: (row.splits ?? []).map((s: any) => ({
      id: s.id,
      expense_id: row.id,
      member_id: s.member_id,
      share_amount: s.share_amount,
      settled: s.settled,
      member_name: s.member?.display_name ?? null,
    })) as ExpenseSplit[],
  })) as Expense[];
}

// ─── Settlement summary ──────────────────────────────────────────────────────

export async function getSettlementSummary(tripId: string): Promise<DebtRecord[]> {
  // Fetch all unsettled splits with payer info
  const { data, error } = await (supabase as any)
    .from("expense_splits")
    .select(`
      id,
      member_id,
      share_amount,
      settled,
      debtor:trip_members!expense_splits_member_id_fkey(display_name),
      expense:expenses!expense_splits_expense_id_fkey(
        paid_by,
        payer:trip_members!expenses_paid_by_fkey(display_name)
      )
    `)
    .eq("settled", false)
    .eq("expenses.trip_id", tripId);

  if (error) throw error;

  // Net balance map: member_id → amount (positive = owed to them, negative = they owe)
  const balances = new Map<string, { name: string | null; net: number }>();
  // Track split_ids per (debtor → creditor) pair for bulk settle
  const pairSplits = new Map<string, { amount: number; split_ids: string[]; from_name: string | null; to_name: string | null }>();

  for (const row of data ?? []) {
    const debtorId = row.member_id as string;
    const creditorId = row.expense?.paid_by as string;
    if (!creditorId || debtorId === creditorId) continue; // payer's own split already settled

    const share = Number(row.share_amount);
    const debtorName: string | null = row.debtor?.display_name ?? null;
    const creditorName: string | null = row.expense?.payer?.display_name ?? null;

    // Update net balance
    if (!balances.has(debtorId)) balances.set(debtorId, { name: debtorName, net: 0 });
    if (!balances.has(creditorId)) balances.set(creditorId, { name: creditorName, net: 0 });
    balances.get(debtorId)!.net -= share;
    balances.get(creditorId)!.net += share;

    // Track per-pair
    const pairKey = `${debtorId}→${creditorId}`;
    if (!pairSplits.has(pairKey)) {
      pairSplits.set(pairKey, { amount: 0, split_ids: [], from_name: debtorName, to_name: creditorName });
    }
    const pair = pairSplits.get(pairKey)!;
    pair.amount += share;
    pair.split_ids.push(row.id as string);
  }

  // Simplify: cancel out A→B and B→A debts
  const debts: DebtRecord[] = [];
  const processed = new Set<string>();

  for (const [key, val] of pairSplits.entries()) {
    if (processed.has(key)) continue;
    const [fromId, toId] = key.split("→");
    const reverseKey = `${toId}→${fromId}`;
    const reverse = pairSplits.get(reverseKey);

    const net = val.amount - (reverse?.amount ?? 0);
    if (Math.abs(net) < 0.01) {
      processed.add(key);
      processed.add(reverseKey);
      continue;
    }

    if (net > 0) {
      debts.push({
        from_member_id: fromId,
        from_name: val.from_name,
        to_member_id: toId,
        to_name: val.to_name,
        amount: Math.round(net * 100) / 100,
        split_ids: val.split_ids,
      });
    } else {
      debts.push({
        from_member_id: toId,
        from_name: val.to_name,
        to_member_id: fromId,
        to_name: val.from_name,
        amount: Math.round(Math.abs(net) * 100) / 100,
        split_ids: reverse?.split_ids ?? [],
      });
    }

    processed.add(key);
    processed.add(reverseKey);
  }

  return debts.sort((a, b) => b.amount - a.amount);
}

// ─── Mark a debt pair as settled ────────────────────────────────────────────

export async function markSplitsSettled(splitIds: string[]): Promise<void> {
  if (splitIds.length === 0) return;
  const { error } = await (supabase as any)
    .from("expense_splits")
    .update({ settled: true })
    .in("id", splitIds);
  if (error) throw error;
}
