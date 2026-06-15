export interface Expense {
  id: string;
  trip_id: string;
  paid_by: string;
  title: string;
  amount: number;
  currency: string;
  expense_date: string;
  // joined
  payer_name?: string | null;
  splits?: ExpenseSplit[];
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  member_id: string;
  share_amount: number;
  settled: boolean;
  // joined
  member_name?: string | null;
}

export interface AddExpenseInput {
  title: string;
  amount: number;
  paid_by: string;       // member_id of payer
  expense_date: string;  // ISO date string
  split_member_ids: string[];
}

export interface DebtRecord {
  from_member_id: string;
  from_name: string | null;
  to_member_id: string;
  to_name: string | null;
  amount: number;
  /** expense_split ids that make up this debt (for bulk settle) */
  split_ids: string[];
}
