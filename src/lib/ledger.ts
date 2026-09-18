import { supabase } from '@/lib/supabase';
import { doc, collection } from '@/lib/firebase';

type Account =
  | 'Cash'
  | 'MarketplaceBalance'
  | 'Inventory'
  | 'COGS'
  | 'Sales'
  | 'MarketplaceFeeExpense'
  | 'Capital'
  | 'AccountsPayable'
  | 'AccountsReceivable'
  | 'CustomerWallet'
  | 'LossOnInventory'
  | 'GainOnInventory';

export interface LedgerEntry {
  date?: any;
  debitAccount: Account;
  creditAccount: Account;
  amount: number;
  memo?: string;
  refType?: string;
  refId?: string;
  referenceId?: string;
  postedBy?: string;
  extra?: Record<string, unknown>;
}

/**
 * Mencatat jurnal double-entry ke tabel 'ledger_entries'
 */
export const postJournal = async (entry: LedgerEntry, tx?: any) => {
  if (!entry || !entry.debitAccount || !entry.creditAccount || !entry.amount) return;

  try {
    const id = `ledg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const entryDate = entry.date
      ? (typeof entry.date?.toISOString === 'function' ? entry.date.toISOString() : entry.date)
      : now;

    const raw_data = {
      date: entryDate,
      debitAccount: entry.debitAccount,
      creditAccount: entry.creditAccount,
      amount: Number(entry.amount),
      memo: entry.memo || '',
      refType: entry.refType || '',
      refId: entry.refId || entry.referenceId || '',
      postedBy: entry.postedBy || 'system',
      extra: entry.extra || {},
      createdAt: now,
      updatedAt: now,
    };

    if (tx && typeof tx.set === 'function') {
      const docRef = doc(collection({} as any, 'ledger_entries'), id);
      tx.set(docRef, raw_data);
      return;
    }

    const { error } = await supabase.from('ledger_entries').insert({
      id,
      raw_data,
      created_at: now,
      updated_at: now,
    });

    if (error) {
      console.error('Error posting journal:', error);
    }
  } catch (err) {
    console.error('postJournal error:', err);
  }
};
