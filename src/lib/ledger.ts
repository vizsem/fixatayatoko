import { addDoc, collection, doc, serverTimestamp, WriteBatch, Transaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
  | 'CustomerWallet';

export interface LedgerEntry {
  date?: any;
  debitAccount: Account;
  creditAccount: Account;
  amount: number;
  memo?: string;
  refType?: string;
  refId?: string;
  extra?: Record<string, unknown>;
}

/**
 * Mencatat jurnal double-entry sederhana ke koleksi 'ledger_entries'
 * Supports optional batch or transaction for atomic operations
 */
export const postJournal = async (entry: LedgerEntry, batchOrTx?: WriteBatch | Transaction) => {
  if (!entry || !entry.debitAccount || !entry.creditAccount || !entry.amount) return;
  
  const ledgerData = {
    ...entry,
    date: serverTimestamp()
  };

  const newLogRef = doc(collection(db, 'ledger_entries'));
  
  if (batchOrTx) {
    if ('commit' in batchOrTx) {
      // It's a WriteBatch
      (batchOrTx as WriteBatch).set(newLogRef, ledgerData);
    } else {
      // It's a Transaction
      (batchOrTx as Transaction).set(newLogRef, ledgerData);
    }
  } else {
    await addDoc(collection(db, 'ledger_entries'), ledgerData);
  }
};
