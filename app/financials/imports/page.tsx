"use client";

import { useState } from "react";

import ImportDropzone from "@/components/widgets/ImportDropzone";

import {
  importBankTransactions,
} from "@/lib/services/banking";
import {
  ImportedTransaction,
} from "@/app/types/finance";

export default function BankingImportsPage() {
  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    fileName,
    setFileName,
  ] = useState("");
  const [
  transactions,
  setTransactions,
] = useState<
  ImportedTransaction[]
>([]);

  async function handleImport(
    file: File
  ) {
    setLoading(true);

    setFileName(file.name);

    const result =
      await importBankTransactions(
        file
      );

    console.log(
  "IMPORT RESULT:",
  result
);

if (
  result.success &&
  result.data
) {
  setTransactions(
    result.data
  );
}

    setLoading(false);
  }

  return (
  <div
  className="
    mx-auto
    max-w-7xl
    space-y-8
    px-6
    pt-8
    pb-12
  "
>

      <div>

        <p
          className="
            text-sm
            uppercase
            tracking-[0.25em]
            text-zinc-500
          "
        >
          Financial Operations
        </p>

        <h1
          className="
            mt-3
            text-5xl
            font-black
            tracking-tight
            text-white
          "
        >
          Banking Imports
        </h1>

        <p
          className="
            mt-4
            max-w-3xl
            text-lg
            leading-8
            text-zinc-400
          "
        >
          Import transactional banking data for
          reconciliation,
          arrears allocation,
          and operational financial intelligence.
        </p>

      </div>

      <ImportDropzone
      
        title="Bank Transaction Import"
        

        description="
Upload banking CSV files to begin transaction normalization and reconciliation workflows.
        "

        loading={loading}

        fileName={fileName}

        onFileSelect={
          handleImport
        }
      />
{transactions.length > 0 && (

  <div
    className="
      overflow-hidden
      rounded-3xl
      border
      border-zinc-800
      bg-zinc-900
    "
  >

    <div className="border-b border-zinc-800 p-6">

      <p
        className="
          text-sm
          uppercase
          tracking-[0.25em]
          text-zinc-500
        "
      >
        Parsed Transactions
      </p>

      <h2
        className="
          mt-3
          text-3xl
          font-black
          text-white
        "
      >
        Transaction Preview
      </h2>

    </div>

    <div className="overflow-x-auto">

      <table className="w-full">

        <thead
          className="
            border-b
            border-zinc-800
            bg-black/30
          "
        >

          <tr>

            <th
              className="
                px-6
                py-4
                text-left
                text-xs
                uppercase
                tracking-[0.2em]
                text-zinc-500
              "
            >
              Date
            </th>

            <th
              className="
                px-6
                py-4
                text-left
                text-xs
                uppercase
                tracking-[0.2em]
                text-zinc-500
              "
            >
              Description
            </th>
<th
  className="
    px-6
    py-4
    text-left
    text-xs
    uppercase
    tracking-[0.2em]
    text-zinc-500
  "
>
  Tenant Match
</th>
<th
  className="
    px-6
    py-4
    text-left
    text-xs
    uppercase
    tracking-[0.2em]
    text-zinc-500
  "
>
  Lease Match
</th>
<th
  className="
    px-6
    py-4
    text-left
    text-xs
    uppercase
    tracking-[0.2em]
    text-zinc-500
  "
>
  Suggested Action
</th>
<th
  className="
    px-6
    py-4
    text-left
    text-xs
    uppercase
    tracking-[0.2em]
    text-zinc-500
  "
>
  Review Priority
</th>
<th
  className="
    px-6
    py-4
    text-left
    text-xs
    uppercase
    tracking-[0.2em]
    text-zinc-500
  "
>
  Escalation
</th>
            <th
              className="
                px-6
                py-4
                text-right
                text-xs
                uppercase
                tracking-[0.2em]
                text-zinc-500
              "
            >
              Amount
            </th>
            <th
  className="
    px-6
    py-4
    text-left
    text-xs
    uppercase
    tracking-[0.2em]
    text-zinc-500
  "
>
  Status
</th>
<th
  className="
    px-6
    py-4
    text-right
    text-xs
    uppercase
    tracking-[0.2em]
    text-zinc-500
  "
>
  Confidence
</th>

          </tr>

        </thead>

        <tbody>

          {transactions.map(
            (
              transaction,
              index
            ) => (

              <tr
                key={index}
                className="
                  border-b
                  border-zinc-800
                "
              >

                <td
                  className="
                    px-6
                    py-5
                    text-sm
                    text-zinc-300
                  "
                >
                  {
                    transaction.transactionDate
                  }
                </td>

                <td
                  className="
                    px-6
                    py-5
                    text-sm
                    text-white
                  "
                >
                  {
                    transaction.description
                  }
                </td>
<td
  className="
    px-6
    py-5
    text-sm
  "
>
  {transaction.matchedTenant ? (

    <span className="text-green-300 font-medium">

      {transaction.matchedTenant}

    </span>

  ) : (

    <span className="text-zinc-500">

      No Match

    </span>

  )}
</td>
<td
  className="
    px-6
    py-5
    text-sm
  "
>
  {transaction.matchedLease ? (

    <span className="text-blue-300 font-medium">

      {transaction.matchedLease}

    </span>

  ) : (

    <span className="text-zinc-500">

      No Lease

    </span>

  )}
</td>
<td
  className="
    px-6
    py-5
    text-sm
  "
>
  {transaction.allocationAction ? (

    <span className="text-white font-medium">

      {transaction.allocationAction}

    </span>

  ) : (

    <span className="text-zinc-500">

      No Action

    </span>

  )}
</td>
<td
  className="
    px-6
    py-5
  "
>

  <span
    className={`
      rounded-full
      px-3
      py-1
      text-xs
      font-semibold

      ${
        transaction.reviewPriority ===
        "high"
          ? "bg-red-500/20 text-red-300"
          : transaction.reviewPriority ===
            "medium"
          ? "bg-orange-500/20 text-orange-300"
          : "bg-green-500/20 text-green-300"
      }
    `}
  >

    {
      transaction.reviewPriority
    }

  </span>

</td>
<td
  className="
    px-6
    py-5
  "
>

  {transaction.requiresEscalation ? (

    <span
      className="
        rounded-full
        bg-red-500/20
        px-3
        py-1
        text-xs
        font-semibold
        text-red-300
      "
    >
      Escalate
    </span>

  ) : (

    <span
      className="
        rounded-full
        bg-green-500/20
        px-3
        py-1
        text-xs
        font-semibold
        text-green-300
      "
    >
      Normal
    </span>

  )}

</td>
                <td
                  className="
                    px-6
                    py-5
                    text-right
                    font-semibold
                    text-white
                  "
                >
                  R
                  {transaction.amount.toLocaleString()}
                </td>
                <td
  className="
    px-6
    py-5
  "
>

  <span
    className={`
      rounded-full
      px-3
      py-1
      text-xs
      font-semibold

      ${
        transaction.status ===
        "matched"
          ? "bg-green-500/20 text-green-300"
          : "bg-orange-500/20 text-orange-300"
      }
    `}
  >

    {transaction.status}

  </span>

</td>
<td
  className="
    px-6
    py-5
    text-right
    font-semibold
    text-white
  "
>
  {
    transaction.matchConfidence
  }
  %
</td>

              </tr>

            )
          )}

        </tbody>

      </table>

    </div>

  </div>

)}
    </div>
  );
}