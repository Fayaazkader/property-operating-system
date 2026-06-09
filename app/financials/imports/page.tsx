"use client";

import { useState, useEffect } from "react";

import ImportDropzone from "@/components/widgets/ImportDropzone";

import {
  importBankTransactions,
} from "@/lib/services/banking";
import {
  ImportedTransaction,
} from "@/app/types/finance";
import TransactionReviewPanel from "@/components/financials/TransactionReviewPanel";
import {
  getEscalatedExposure,
  getGovernanceBlockedTransactions,
  getReadyToPostValue,
} from "@/lib/analytics/executive";
import {
  currentUser,
} from "@/lib/auth/mock-session";

import {
  canPostTransactions,
} from "@/lib/auth/permissions";
import {
  getBulkCompletableTransactions,
} from "@/lib/finance/bulk-governance";
import {
  getTransactionExceptionReason,
} from "@/lib/finance/exception-reasons";
import {
  isExceptionTransaction,
} from "@/lib/finance/exception-queue";
import {
  logOperationalEvent,
  operationalAuditEvents,
} from "@/lib/audit/operational-audit";
import {
  getTransactionSeverity,
} from "@/lib/finance/severity";
import {
  getOperationalHealth,
} from "@/lib/finance/operational-health";
import "@/app/globals.css";
import { supabase } from "@/lib/supabase";

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
  postingMessage,
  setPostingMessage,
] = useState("");
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
  | "exceptions"
>("all");
 const [dataLoaded, setDataLoaded] = useState(false);

// Load existing transactions from Supabase on mount
useEffect(() => {
  async function loadTransactions() {
    const { data, error } = await supabase
      .from("bank_transactions")
      .select("*")
      .order("imported_at", { ascending: false })
      .limit(50);

    if (data && data.length > 0) {
      // Map DB columns to ImportedTransaction shape
      const mapped = data.map((tx: any) => ({
        ...tx,
        amount: tx.transaction_amount || 0,
        description: tx.transaction_description || "",
        transactionDate: tx.transaction_date || "",
        reference: tx.transaction_reference || "",
        splitAllocations: tx.split_allocations || [],
        allocationStatus: tx.allocation_status || "unallocated",
      }));
      setTransactions(mapped as ImportedTransaction[]);
    }
    setDataLoaded(true);
  }
  loadTransactions();
}, []);
const operationalActivity = [
  {
    id: "1",

    title:
      "Escalation triggered",

    description:
      "Large unmatched payment requires operational review.",

    severity:
      "critical",

    createdAt:
      "5 min ago",
  },

  {
    id: "2",

    title:
      "Transactions posted",

    description:
      "12 operationally approved transactions were posted successfully.",

    severity:
      "info",

    createdAt:
      "18 min ago",
  },

  {
    id: "3",

    title:
      "Governance protection activated",

    description:
      "Cross-entity allocation attempt was automatically blocked.",

    severity:
      "warning",

    createdAt:
      "42 min ago",
  },
];
const currentUserRole =
  "manager";
function updateTransaction(
  transactionId: string,

  updates: Partial<
    ImportedTransaction
  >
) {

  setTransactions(
    (
      currentTransactions
    ) =>
      currentTransactions.map(
        (transaction) =>

          transaction.id ===
          transactionId
            ? {
                ...transaction,
                ...updates,
              }
            : transaction
      )
  );

}
async function handleBulkPost() {

  const selectedReadyTransactions =

    transactions.filter(
      (transaction) =>

        selectedTransactions.includes(
          transaction.id
        )
    );
    if (
  !canPostTransactions(
    currentUser.role
  )
) {

  alert(
    "You do not have permission to post transactions."
  );
  

  return;
}

  if (
    selectedReadyTransactions.length ===
    0
  ) {

    alert(
      "Select at least one ready transaction."
    );

    return;
  }
const completableTransactions =
  getBulkCompletableTransactions(
    selectedReadyTransactions
  );
  const invalidTransactions =

  selectedReadyTransactions.filter(
    (transaction) =>

      transaction.queue !==
        "ready" ||

      transaction.status !==
        "matched" ||

      !transaction.isBalanced
  );
  const exceptionReasons =
  invalidTransactions
    .map(
      (transaction) =>
        getTransactionExceptionReason(
          transaction
        )
    )
    .filter(Boolean);

  if (
    invalidTransactions.length > 0
  ) {

    alert(
  `
${invalidTransactions.length} transactions require review:

${exceptionReasons.join("\n")}
  `
);

    return;
  }

  setTransactions(
    transactions.map(
      (transaction) => {

        if (
          selectedTransactions.includes(
            transaction.id
          )
        ) {

         const autoComplete =
  completableTransactions.some(
    
    (
      completableTransaction
    ) =>

      completableTransaction.id ===
      transaction.id
  );
  logOperationalEvent({
  id: crypto.randomUUID(),

  action:
    autoComplete
      ? "Transaction auto-completed"
      : "Transaction approved",

  severity:
    autoComplete
      ? "info"
      : "warning",

  transactionId:
    transaction.id,

  createdAt:
    new Date().toLocaleString(),
});

return {
  ...transaction,

  status:
    "matched",

  queue:
    autoComplete
      ? "posted"
      : "ready",

  workflowStatus:
    autoComplete
      ? "resolved"
      : "assigned",

  postingStatus:
    autoComplete
      ? "finalized"
      : "approved",
};

        }

        return transaction;

      }
    )
  );

    setSelectedTransactions([]);
  
  // Persist status changes to Supabase
  for (const tx of selectedReadyTransactions) {
    await supabase
      .from("bank_transactions")
      .update({
        allocation_status: "posted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tx.id);
  }

  setPostingMessage(
    `${selectedReadyTransactions.length} transactions successfully posted`
  );

  setTimeout(() => {
    setPostingMessage("");
  }, 4000);
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
    : activeFilter ===
      "exceptions"
    ? isExceptionTransaction(
        transaction
      )
    : transaction.requiresEscalation ===
      true;

      return (
        queueMatch &&
        filterMatch
      );

    }
  );
  
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
const readyToPostValue =
  getReadyToPostValue(
    transactions
  );

const escalatedExposure =
  getEscalatedExposure(
    transactions
  );

const governanceBlockedCount =
  getGovernanceBlockedTransactions(
    transactions
  ).length;
  const operationalHealth =
  getOperationalHealth(
    transactions
  );
  async function handleImport(file: File) {
  setLoading(true);
  setFileName(file.name);

  const result = await importBankTransactions(file);

  console.log("IMPORT RESULT:", result);

  if (result.success && result.data) {
    setTransactions(result.data);

    // Persist each transaction to Supabase
    for (const tx of result.data) {
      const { error: insertError } = await supabase
        .from("bank_transactions")
        .upsert({
          id: tx.id,
          transaction_date: tx.transactionDate || null,
          transaction_description: tx.description || null,
          transaction_amount: tx.amount || 0,
          transaction_reference: tx.reference || null,
          bank_account_name: null,
          bank_account_number: null,
          allocation_status: tx.allocationStatus || "unallocated",
          split_allocations: tx.splitAllocations || [],
          imported_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Failed to save transaction:", tx.id, insertError);
      }
    }
  }

  setLoading(false);
}

  return (
  <>
    
    
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
            text-3xl
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
      <div
  className={`
    rounded-3xl
    border
    p-4

    ${
      operationalHealth.severity ===
      "critical"
        ? "border-red-500/20 bg-red-500/[0.05]"
        : operationalHealth.severity ===
          "warning"
        ? "border-orange-500/20 bg-orange-500/[0.05]"
        : "border-green-500/20 bg-green-500/[0.05]"
    }
  `}
>

  <div
    className="
      flex
      items-center
      justify-between
    "
  >

    <div>

      <p
        className="
          text-xs
          uppercase
          tracking-[0.2em]
          text-zinc-500
        "
      >
        Operational Health
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
          operationalHealth.label
        }
      </h2>

    </div>

  </div>

</div>
      {
  postingMessage && (

    <div
      className="
        rounded-3xl
        border
        border-green-500/20
        bg-green-500/[0.05]
        p-4
      "
    >

      <p
        className="
          text-sm
          font-semibold
          text-green-300
        "
      >
        {postingMessage}
      </p>

      <p
        className="
          mt-2
          text-sm
          text-zinc-400
        "
      >
        Operational queues updated
        successfully.
      </p>

    </div>

  )
}
      <div className="grid gap-4 md:grid-cols-4">

  <div
    className="
      rounded-3xl
      border
      border-green-500/20
      bg-green-500/10
      p-4
    "
  >

    <p className="text-sm text-green-300">
      Ready To Post
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
      p-4
    "
  >

    <p className="text-sm text-orange-300">
      Needs Review
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
      p-4
    "
  >

    <p className="text-sm text-red-300">
      Escalated
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
        transactions.filter(
          
          (transaction) =>
            transaction.queue ===
            "escalated"
        ).length
      }
    </h2>

  </div>

</div>
<div
  className="
    mt-6
    grid
    gap-6
    xl:grid-cols-3
  "
>

  <button
  type="button"
  onClick={() => {

    setActiveQueue(
      "ready"
    );

    setActiveFilter(
      "all"
    );

  }}
  className="
    rounded-3xl
    border
    border-zinc-800
    bg-zinc-900/70
    p-4
    text-left
    transition
    hover:border-zinc-700
    hover:bg-zinc-900
  "
>

    <p
      className="
        text-xs
        uppercase
        tracking-[0.2em]
        text-zinc-500
      "
    >
      Ready To Post
    </p>

    <h3
      className="
        mt-4
        text-4xl
        font-black
        text-white
      "
    >
      R
      {readyToPostValue.toLocaleString()}
    </h3>

    <p
      className="
        mt-4
        text-sm
        text-zinc-500
      "
    >
      Operationally approved
      transactions awaiting posting.
    </p>
    <p
  className="
    mt-4
    text-xs
    font-semibold
    text-green-300
  "
>
  Stable operational queue
</p>

  </button>

  <button
  type="button"
  onClick={() => {

    setActiveQueue(
      "escalated"
    );

    setActiveFilter(
      "escalated"
    );

  }}
  className="
    rounded-3xl
    border
    border-red-500/20
    bg-red-500/[0.04]
    p-4
    text-left
    transition
    hover:border-red-500/40
    hover:bg-red-500/[0.08]
  "
>

    <p
      className="
        text-xs
        uppercase
        tracking-[0.2em]
        text-red-300
      "
    >
      Escalated Exposure
    </p>

    <h3
      className="
        mt-4
        text-4xl
        font-black
        text-white
      "
    >
      R
      {escalatedExposure.toLocaleString()}
    </h3>

    <p
      className="
        mt-4
        text-sm
        text-zinc-400
      "
    >
      Financial exposure currently
      requiring operational review.
    </p>
    <p
  className="
    mt-4
    text-xs
    font-semibold
    text-red-300
  "
>
  Requires immediate attention
</p>

  </button>
  

  <button
  type="button"
  onClick={() => {

    setActiveQueue(
      "governance"
    );

    setActiveFilter(
      "all"
    );

  }}
  className="
    rounded-3xl
    border
    border-purple-500/20
    bg-purple-500/[0.04]
    p-4
    text-left
    transition
    hover:border-purple-500/40
    hover:bg-purple-500/[0.08]
  "
>

    <p
      className="
        text-xs
        uppercase
        tracking-[0.2em]
        text-purple-300
      "
    >
      Governance Blocks
    </p>

    <h3
      className="
        mt-4
        text-4xl
        font-black
        text-white
      "
    >
      {
        governanceBlockedCount
      }
    </h3>

    <p
      className="
        mt-4
        text-sm
        text-zinc-400
      "
    >
      Transactions blocked by
      governance enforcement rules.
    </p>
    <p
  className="
    mt-4
    text-xs
    font-semibold
    text-purple-300
  "
>
  Governance protection active
</p>

  </button>

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
      p-4
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
  disabled={
  filteredTransactions.filter(
    (transaction) =>
      transaction.queue ===
        "ready" &&
      transaction
        .matchConfidence &&
      transaction
        .matchConfidence >=
        85
  ).length === 0
}
  onClick={() => {

    const readyTransactions =
      filteredTransactions
        .filter(
          (
            transaction
          ) =>
            transaction.queue ===
              "ready" &&
            transaction
              .matchConfidence &&
            transaction
              .matchConfidence >=
              85
        )
        .map(
          (
            transaction
          ) =>
            transaction.id
        );

    setSelectedTransactions(
      readyTransactions
    );

  }}
  className="
    rounded-2xl
    border
    border-zinc-700
    px-5
    py-3
    text-sm
    font-semibold
    text-zinc-300
    transition
    hover:border-zinc-500
    hover:text-white
    disabled:cursor-not-allowed
disabled:opacity-40
  "
>
  Select Ready
</button>
<button
  type="button"
 onClick={() => {

  if (
    !selectedTransaction
  ) {
    return;
  }

  updateTransaction(
    selectedTransaction.id,
    {
  queue: "ready",

  requiresEscalation:
    false,

  status: "matched",

  matchConfidence: 100,
}
  );

  setActiveQueue(
    "ready"
  );

  setActiveFilter(
    "all"
  );

  setReviewOpen(false);

}}
  className="
    rounded-2xl
    border
    border-orange-500/20
    bg-orange-500/10
    px-5
    py-3
    text-sm
    font-semibold
    text-orange-300
    transition
    hover:bg-orange-500/20
  "
>
  Confirm Match
</button>
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
 Smart Approve & Post
</button>
{
  !canPostTransactions(
    currentUser.role
  ) && (

    <p
      className="
        mt-3
        text-xs
        text-red-400
      "
    >
      Your role does not
      have posting authority.
    </p>

  )
}
{
  currentUserRole ===
  "manager" && (
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
        onClick={() => setSelectedTransactions([])}
        
      >
        
        Clear
      </button>
      )
}

    </div>

  </div>


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

    <div className="border-b border-zinc-800 p-4">


      <h2
        className="
          mt-3
          text-2xl
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
  truncate
  text-sm
  font-medium
  text-white
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

    <div
  className="
    overflow-hidden
  "
>

  <table
  className="
    w-full
  
  "
>

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
  px-4
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
  px-4
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
  w-[160px]
  px-4
  py-4
  text-left
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
  px-4
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
  px-8
  py-4
  text-left
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
      colSpan={7}
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
) => {

  const severity =
    getTransactionSeverity(
      transaction
    );

  return (
              

              <tr
              
              
  key={index}
  className={`
  border-b
  border-zinc-800
  transition
  hover:bg-white/[0.03]

  ${
    severity ===
    "critical"
      ? "bg-red-500/[0.05]"
      : severity ===
        "warning"
      ? "bg-orange-500/[0.04]"
      : transaction.queue ===
        "posted"
      ? "opacity-60"
      : ""
  }
`}
>
  <td
  className="
    px-4
py-4
  "
>

  <input
    type="checkbox"
    disabled={
  transaction.queue ===
  "posted"
}
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
      disabled:cursor-not-allowed
disabled:opacity-40
    "
  />

</td>

                <td
                  className="
                    px-4
py-4
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
                    px-4
py-4
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
    w-[160px]
    px-4
    py-4
    text-white
  "
>
  R
  {transaction.amount.toLocaleString()}
</td>        
<td
  className="
    px-4
py-4
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
  w-[180px]
  px-4
  py-4
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
    disabled={
  transaction.queue ===
  "posted"
}
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
      px-8
  py-4
      text-sm
      text-zinc-300
      transition
      hover:border-zinc-500
      hover:text-white
      disabled:cursor-not-allowed
disabled:opacity-40
    "
  >
    Review
  </button>

</td>


              </tr>

            );

          }
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
  onUpdateTransaction={
  (
    updatedTransaction
  ) => {
    setSelectedTransaction(
  updatedTransaction
);

    setTransactions(
      transactions.map(
        (
          transaction
        ) =>
          

          transaction.id ===
          updatedTransaction.id
            ? updatedTransaction
            : transaction
      )
    );
  }
}
/>
    </div>
  </>
  );
}