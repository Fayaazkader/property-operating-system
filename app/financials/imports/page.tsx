"use client";

import { useState } from "react";

import ImportDropzone from "@/components/widgets/ImportDropzone";

import {
  importBankTransactions,
} from "@/lib/services/banking";
import {
  ImportedTransaction,
} from "@/app/types/finance";
import TransactionReviewPanel from "@/components/financials/TransactionReviewPanel";

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

const [
  selectedTransaction,
  setSelectedTransaction,
] =
  useState<
    ImportedTransaction | null
  >(null);

const [
  reviewOpen,
  setReviewOpen,
] = useState(false);
const [
  selectedTransactions,
  setSelectedTransactions,
] = useState<string[]>(
  []
);

const [
  activeQueue,
  setActiveQueue,
] = useState<
  "all" |
  "ready" |
  "review" |
  "escalated" |
  "posted"
  | "governance"
>("all");
const [
  activeFilter,
  setActiveFilter,
] = useState<
  | "all"
  | "matched"
  | "unmatched"
  | "highPriority"
  | "escalated"
>("all");
function handleBulkPost() {
  

  setTransactions(
    transactions.map(
      (transaction) => {

        if (
          selectedTransactions.includes(
            transaction.id
          )
        ) {

          return {
            ...transaction,

            status:
              "posted",

            queue:
              "posted",
          };

        }

        return transaction;

      }
    )
  );

  setSelectedTransactions(
    []
  );
}
const filteredTransactions =
  transactions.filter(
    (transaction) => {

      const queueMatch =
        activeQueue === "all"
          ? true
          : transaction.queue ===
            activeQueue;

      const filterMatch =
        activeFilter === "all"
          ? true
          : activeFilter ===
            "matched"
          ? transaction.status ===
            "matched"
          : activeFilter ===
            "unmatched"
          ? transaction.status ===
            "unmatched"
          : activeFilter ===
            "highPriority"
          ? transaction.reviewPriority ===
            "high"
          : transaction.requiresEscalation ===
            true;

      return (
        queueMatch &&
        filterMatch
      );

    }
  );
  <div className="flex flex-wrap gap-3">

  {[
    {
      key: "all",
      label: "All",
    },
    {
      key: "matched",
      label: "Matched",
    },
    {
      key: "unmatched",
      label: "Unmatched",
    },
    {
      key: "highPriority",
      label: "High Priority",
    },
    {
      key: "escalated",
      label: "Escalated",
    },
  ].map((filter) => (

    <button
      key={filter.key}
      type="button"
      onClick={() =>
        setActiveFilter(
          filter.key as
            | "all"
            | "matched"
            | "unmatched"
            | "highPriority"
            | "escalated"
        )
      }
      className={`
        rounded-full
        px-4
        py-2
        text-xs
        font-semibold
        transition

        ${
          activeFilter ===
          filter.key
            ? "bg-white text-black"
            : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        }
      `}
    >

      {filter.label}

    </button>

  ))}

</div>
    const queueCounts = {
  all:
    transactions.length,

  ready:
    transactions.filter(
      (transaction) =>
        transaction.queue ===
        "ready"
    ).length,

  review:
    transactions.filter(
      (transaction) =>
        transaction.queue ===
        "review"
    ).length,

  escalated:
    transactions.filter(
      (transaction) =>
        transaction.queue ===
        "escalated"
    ).length,

  governance:
    transactions.filter(
      (transaction) =>
        transaction.queue ===
        "governance"
    ).length,

  posted:
    transactions.filter(
      (transaction) =>
        transaction.queue ===
        "posted"
    ).length,
};
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
      <div className="grid gap-6 md:grid-cols-3">

  <div
    className="
      rounded-3xl
      border
      border-green-500/20
      bg-green-500/10
      p-6
    "
  >

    <p className="text-sm text-green-300">
      Ready To Post
    </p>

    <h2
      className="
        mt-3
        text-5xl
        font-black
        text-white
      "
    >
      {
        transactions.filter(
          (transaction) =>
            transaction.queue ===
            "ready"
        ).length
      }
    </h2>

  </div>

  <div
    className="
      rounded-3xl
      border
      border-orange-500/20
      bg-orange-500/10
      p-6
    "
  >

    <p className="text-sm text-orange-300">
      Needs Review
    </p>

    <h2
      className="
        mt-3
        text-5xl
        font-black
        text-white
      "
    >
      {
        transactions.filter(
          (transaction) =>
            transaction.queue ===
            "review"
        ).length
      }
    </h2>

  </div>

  <div
    className="
      rounded-3xl
      border
      border-red-500/20
      bg-red-500/10
      p-6
    "
  >

    <p className="text-sm text-red-300">
      Escalated
    </p>

    <h2
      className="
        mt-3
        text-5xl
        font-black
        text-white
      "
    >
     
      {
        transactions.filter(
          
          (transaction) =>
            transaction.queue ===
            "escalated"
        ).length
      }
    </h2>

  </div>

</div>
<div className="flex flex-wrap gap-3">

  {[
    "all",
    "ready",
    "review",
    "escalated",
    "governance",
    "posted",
  ].map((queue) => (

    <button
      key={queue}
      type="button"
      onClick={() =>
        setActiveQueue(
          queue as
            | "all"
            | "ready"
            | "review"
            | "escalated"
            | "posted"
        )
      }
      className={`
        rounded-2xl
        px-5
        py-3
        text-sm
        font-semibold
        capitalize
        transition

        ${
          activeQueue === queue
            ? "bg-white text-black"
            : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        }
      `}
    >

      {queue} (
{
  queueCounts[
    queue as keyof typeof queueCounts
  ]
}
)

    </button>

  ))}

</div>
{selectedTransactions.length >
  0 && (

  <div
    className="
      mb-6
      flex
      items-center
      justify-between
      rounded-3xl
      border
      border-blue-500/20
      bg-blue-500/10
      p-6
    "
  >

    <div>

      <p
        className="
          text-sm
          text-blue-300
        "
      >
        {
          selectedTransactions.length
        }{" "}
        transactions selected
      </p>

    </div>

    <div className="flex gap-4">

      <button
  type="button"
  disabled={selectedTransactions.some(
    (id) => {

      const transaction =
        transactions.find(
          (transaction) =>
            transaction.id ===
            id
        );

      return (
        transaction
          ?.governanceBlocked ===
        true
      );

    }
  )}
  onClick={
    handleBulkPost
  }
  className="
    rounded-2xl
    bg-green-500/20
    px-5
    py-3
    text-sm
    font-semibold
    text-green-300
    transition
    hover:bg-green-500/30
    disabled:cursor-not-allowed
    disabled:opacity-40
  "
>
  Approve & Post
</button>

      <button
        className="
          rounded-2xl
          bg-zinc-800
          px-5
          py-3
          text-sm
          font-semibold
          text-white
          transition
          hover:bg-zinc-700
        "
        onClick={() =>
          setSelectedTransactions(
            []
          )
        }
      >
        Clear
      </button>

    </div>

  </div>

)}
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
        {
  activeQueue === "all"
    ? "All Transactions"
    : activeQueue ===
      "ready"
    ? "Ready To Post"
    : activeQueue ===
      "review"
    ? "Transactions Requiring Review"
    : activeQueue ===
      "escalated"
    ? "Escalated Transactions"
    : "Posted Transactions"
}
      </h2>
      <p
  className="
    mt-3
    max-w-2xl
    text-sm
    leading-7
    text-zinc-500
  "
>

  {
    activeQueue === "all"
      ? "Operational overview across all imported financial transactions."
      : activeQueue ===
        "ready"
      ? "High-confidence transactions ready for operational posting workflows."
      : activeQueue ===
        "review"
      ? "Transactions requiring operational validation and finance review."
      : activeQueue ===
        "escalated"
      ? "High-risk operational exceptions requiring immediate attention."
      : "Previously approved and operationally posted transactions."
  }

</p>

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
  "
/>

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
    text-left
    text-xs
    uppercase
    tracking-[0.2em]
    text-zinc-500
  "
>
  Queue
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
  Actions
</th>



          </tr>
          

        </thead>
        

        <tbody>
          
{filteredTransactions.length ===
0 && (

  <tr>

    <td
      colSpan={6}
      className="
        px-6
        py-20
        text-center
      "
    >

      <div className="mx-auto max-w-md">

        <p
          className="
            text-lg
            font-semibold
            text-white
          "
        >
          No transactions found
        </p>

        <p
          className="
            mt-3
            text-sm
            leading-7
            text-zinc-500
          "
        >
          No transactions currently match
          the selected operational filters.
        </p>

      </div>

    </td>

  </tr>

)}
          {filteredTransactions.map(
            (
              transaction,
              index
            ) => (

              <tr
              
  key={index}
  className={`
  border-b
  border-zinc-800
  transition
  hover:bg-white/[0.03]

  ${
  transaction.queue ===
  "governance"
    ? "bg-purple-500/[0.05]"
    : transaction.queue ===
      "escalated"
    ? "bg-red-500/[0.04]"
    : transaction.queue ===
      "review"
    ? "bg-orange-500/[0.03]"
    : transaction.queue ===
      "posted"
    ? "opacity-60"
    : ""
}
`}
>
  <td
  className="
    px-6
    py-5
  "
>

  <input
    type="checkbox"
    checked={selectedTransactions.includes(
      transaction.id
    )}
    onClick={(event) =>
      event.stopPropagation()
    }
    onChange={(event) => {

      if (
        event.target.checked
      ) {

        setSelectedTransactions(
          [
            ...selectedTransactions,
            transaction.id,
          ]
        );

      } else {

        setSelectedTransactions(
          selectedTransactions.filter(
            (id) =>
              id !==
              transaction.id
          )
        );

      }

    }}
    className="
      h-4
      w-4
      rounded
      border-zinc-700
      bg-zinc-900
    "
  />

</td>

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
        transaction.queue ===
        "ready"
          ? "bg-green-500/20 text-green-300"
          : transaction.queue ===
            "review"
          ? "bg-orange-500/20 text-orange-300"
          : transaction.queue ===
            "escalated"
          ? "bg-red-500/20 text-red-300"
          : "bg-zinc-700 text-zinc-300"
      }
    `}
  >

    {transaction.queue}

  </span>

</td>
<td
  className="
    px-6
    py-5
    text-right
  "
>
{selectedTransaction
  ?.governanceBlocked && (

  <div
    className="
      mb-6
      rounded-2xl
      border
      border-purple-500/20
      bg-purple-500/10
      p-5
    "
  >

    <p
      className="
        text-sm
        font-semibold
        text-purple-300
      "
    >
      Governance Blocked
    </p>

    <p
      className="
        mt-2
        text-sm
        leading-7
        text-zinc-300
      "
    >
      {
        selectedTransaction
          .governanceReason
      }
    </p>

  </div>

)}
  <button
    type="button"
    onClick={() => {

      setSelectedTransaction(
        transaction
      );

      setReviewOpen(true);

    }}
    className="
      rounded-xl
      border
      border-zinc-700
      px-4
      py-2
      text-sm
      text-zinc-300
      transition
      hover:border-zinc-500
      hover:text-white
    "
  >
    Review
  </button>

</td>
              </tr>

            )
          )}

        </tbody>

      </table>

    </div>

  </div>

)}
<TransactionReviewPanel
  transaction={
    selectedTransaction
  }
  open={reviewOpen}
  onClose={() =>
    setReviewOpen(false)
  }
/>
    </div>
  );
}