import { supabase } from "./supabase";
import type {
  Expense,
  ExpenseSplit,
  ExpenseWithSplits,
  MemberBalance,
  SimplifiedDebt,
} from "../types/expense";

export interface AddExpenseInput {
  title: string;
  amount: number;
  currency?: string;
  paidBy: string; // member_id
  expenseDate: string; // ISO date string
  splitMemberIds: string[]; // member_ids included in the split
}

// ----------------------------------------------------------------
// Add expense + create splits in one operation
// ----------------------------------------------------------------
export async function addExpense(tripId: string, data: AddExpenseInput): Promise<Expense> {
  const { title, amount, currency = "THB", paidBy, expenseDate, splitMemberIds } = data;

  if (splitMemberIds.length === 0) {
    throw new Error("Select at least one member to split the expense with.");
  }

  // 1. Insert expense
  const { data: expense, error: expenseError } = await (supabase as any)
    .from("expenses")
    .insert([
      {
        trip_id: tripId,
        paid_by: paidBy,
        title,
        amount,
        currency,
        expense_date: expenseDate,
      },
    ])
    .select()
    .single();

  if (expenseError) throw expenseError;

  // 2. Calculate share amount (rounded to 2 decimals; remainder goes to first split)
  const shareRaw = amount / splitMemberIds.length;
  const shareRounded = Math.round(shareRaw * 100) / 100;
  const totalRounded = shareRounded * splitMemberIds.length;
  const remainder = Math.round((amount - totalRounded) * 100) / 100;

  const splitsPayload = splitMemberIds.map((memberId, index) => ({
    expense_id: expense.id,
    member_id: memberId,
    // give any rounding remainder to the first member in the list
    share_amount: index === 0 ? shareRounded + remainder : shareRounded,
    // if the payer is part of the split, mark their own share as already settled
    // (they don't owe themselves)
    settled: memberId === paidBy,
  }));

  const { error: splitsError } = await (supabase as any)
    .from("expense_splits")
    .insert(splitsPayload);

  if (splitsError) throw splitsError;

  return expense as Expense;
}

// ----------------------------------------------------------------
// Fetch all expenses for a trip, with splits + member names
// ----------------------------------------------------------------
export async function getExpensesByTrip(tripId: string): Promise<ExpenseWithSplits[]> {
  const { data: expenses, error } = await (supabase as any)
    .from("expenses")
    .select(
      `
      *,
      payer:trip_members!expenses_paid_by_fkey(display_name),
      expense_splits(
        *,
        trip_members(display_name)
      )
    `,
    )
    .eq("trip_id", tripId)
    .order("expense_date", { ascending: false });

  if (error) throw error;

  return (expenses ?? []).map((e: any) => ({
    id: e.id,
    trip_id: e.trip_id,
    paid_by: e.paid_by,
    title: e.title,
    amount: e.amount,
    currency: e.currency,
    expense_date: e.expense_date,
    paid_by_name: e.payer?.display_name ?? null,
    splits: (e.expense_splits ?? []).map((s: any) => ({
      id: s.id,
      expense_id: s.expense_id,
      member_id: s.member_id,
      share_amount: s.share_amount,
      settled: s.settled,
      display_name: s.trip_members?.display_name ?? null,
    })),
  })) as ExpenseWithSplits[];
}

export async function getExpenseById(expenseId: string): Promise<ExpenseWithSplits | null> {
  const { data: e, error } = await (supabase as any)
    .from("expenses")
    .select(
      `
      *,
      payer:trip_members!expenses_paid_by_fkey(display_name),
      expense_splits(
        *,
        trip_members(display_name)
      )
    `,
    )
    .eq("id", expenseId)
    .single();

  if (error) throw error;
  if (!e) return null;

  return {
    id: e.id,
    trip_id: e.trip_id,
    paid_by: e.paid_by,
    title: e.title,
    amount: e.amount,
    currency: e.currency,
    expense_date: e.expense_date,
    paid_by_name: e.payer?.display_name ?? null,
    splits: (e.expense_splits ?? []).map((s: any) => ({
      id: s.id,
      expense_id: s.expense_id,
      member_id: s.member_id,
      share_amount: s.share_amount,
      settled: s.settled,
      display_name: s.trip_members?.display_name ?? null,
    })),
  };
}

export async function getTripTotalSpend(tripId: string): Promise<number> {
  const { data, error } = await (supabase as any)
    .from("expenses")
    .select("amount")
    .eq("trip_id", tripId);

  if (error) throw error;
  return (data ?? []).reduce((sum: number, row: any) => sum + Number(row.amount), 0);
}

// ----------------------------------------------------------------
// Settlement: compute net balance per member, then simplify into
// a minimal set of "A owes B" transactions.
// ----------------------------------------------------------------
export async function getSettlementSummary(tripId: string): Promise<{
  balances: MemberBalance[];
  debts: SimplifiedDebt[];
}> {
  const expenses = await getExpensesByTrip(tripId);

  // member_id -> { display_name, paid, owed }
  const balanceMap = new Map<string, MemberBalance>();

  const ensure = (memberId: string, displayName: string | null) => {
    if (!balanceMap.has(memberId)) {
      balanceMap.set(memberId, {
        member_id: memberId,
        display_name: displayName,
        paid: 0,
        owed: 0,
        net: 0,
      });
    }
    return balanceMap.get(memberId)!;
  };

  // Track unsettled splits per (payer, ower) pair so we can reference split_ids later
  const unsettledSplitsByPair = new Map<string, string[]>(); // key: `${ower}->${payer}`

  for (const exp of expenses) {
    const payerBalance = ensure(exp.paid_by, exp.paid_by_name);
    payerBalance.paid += Number(exp.amount);

    for (const split of exp.splits) {
      const owerBalance = ensure(split.member_id, split.display_name);
      owerBalance.owed += Number(split.share_amount);

      // Only unsettled splits where the ower isn't the payer represent real debt
      if (!split.settled && split.member_id !== exp.paid_by) {
        const key = `${split.member_id}->${exp.paid_by}`;
        if (!unsettledSplitsByPair.has(key)) unsettledSplitsByPair.set(key, []);
        unsettledSplitsByPair.get(key)!.push(split.id);
      }
    }
  }

  for (const b of balanceMap.values()) {
    b.net = Math.round((b.paid - b.owed) * 100) / 100;
  }

  // Simplify debts: greedily match biggest debtor with biggest creditor
  const debts = simplifyDebts(Array.from(balanceMap.values()), unsettledSplitsByPair);

  return {
    balances: Array.from(balanceMap.values()).sort((a, b) => b.net - a.net),
    debts,
  };
}

function simplifyDebts(
  balances: MemberBalance[],
  unsettledSplitsByPair: Map<string, string[]>,
): SimplifiedDebt[] {
  // Work on a mutable copy: positive net = creditor, negative net = debtor
  const creditors = balances
    .filter((b) => b.net > 0.01)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.net - a.net);
  const debtors = balances
    .filter((b) => b.net < -0.01)
    .map((b) => ({ ...b, net: -b.net })) // store as positive amount owed
    .sort((a, b) => b.net - a.net);

  const debts: SimplifiedDebt[] = [];

  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.round(Math.min(debtor.net, creditor.net) * 100) / 100;

    if (amount > 0.01) {
      const key = `${debtor.member_id}->${creditor.member_id}`;
      debts.push({
        from_member_id: debtor.member_id,
        from_name: debtor.display_name,
        to_member_id: creditor.member_id,
        to_name: creditor.display_name,
        amount,
        split_ids: unsettledSplitsByPair.get(key) ?? [],
      });
    }

    debtor.net = Math.round((debtor.net - amount) * 100) / 100;
    creditor.net = Math.round((creditor.net - amount) * 100) / 100;

    if (debtor.net <= 0.01) i += 1;
    if (creditor.net <= 0.01) j += 1;
  }

  return debts;
}

// ----------------------------------------------------------------
// Mark a debt (set of expense_splits) as settled
// ----------------------------------------------------------------
export async function markDebtAsSettled(splitIds: string[]): Promise<void> {
  if (splitIds.length === 0) return;

  const { error } = await (supabase as any)
    .from("expense_splits")
    .update({ settled: true })
    .in("id", splitIds);

  if (error) throw error;
}
