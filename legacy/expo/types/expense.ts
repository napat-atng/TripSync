export interface Expense {
  id: string;
  trip_id: string;
  paid_by: string;
  title: string;
  amount: number;
  currency: string;
  expense_date: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  member_id: string;
  share_amount: number;
  settled: boolean;
}

export interface ExpenseWithSplits extends Expense {
  paid_by_name: string | null;
  splits: (ExpenseSplit & { display_name: string | null })[];
}

export interface MemberBalance {
  member_id: string;
  display_name: string | null;
  paid: number;
  owed: number;
  net: number; // positive = should receive, negative = should pay
}

export interface SimplifiedDebt {
  from_member_id: string;
  from_name: string | null;
  to_member_id: string;
  to_name: string | null;
  amount: number;
  // underlying split ids that make up this debt, so "mark as settled" can update them
  split_ids: string[];
}
