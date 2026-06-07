import { CreditCard, FileText, Hash } from "lucide-react";

type BankTransaction = {
  id: string;
  transaction_date: string;
  transaction_description: string;
  transaction_amount: number;
  transaction_reference?: string;
  bank_account_name?: string;
  bank_account_number?: string;
};

interface Props {
  transaction: BankTransaction;
}

export function TransactionReferenceBar({ transaction }: Props) {
  return (
    <div className="flex-shrink-0 border-b border-zinc-800 bg-zinc-950 px-8 py-4">
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-zinc-500" />
          <span className="text-zinc-400">Transaction</span>
          <span className="text-zinc-100 font-medium font-mono">
            {transaction.id?.slice(0, 8)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Amount</span>
          <span className="text-zinc-100 font-semibold tabular-nums">
            R{transaction.transaction_amount?.toLocaleString()}
          </span>
        </div>

        {(transaction.bank_account_name || transaction.bank_account_number) && (
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-zinc-500" />
            <span className="text-zinc-400">Account</span>
            <span className="text-zinc-100 font-mono text-xs">
              {transaction.bank_account_name || transaction.bank_account_number}
            </span>
          </div>
        )}

        {transaction.transaction_reference && (
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-500" />
            <span className="text-zinc-400">Ref</span>
            <span className="text-zinc-300">{transaction.transaction_reference}</span>
          </div>
        )}

        <div className="ml-auto text-zinc-500 text-xs">
          {transaction.transaction_date}
        </div>
      </div>
    </div>
  );
}