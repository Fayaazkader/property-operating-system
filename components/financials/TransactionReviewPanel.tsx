"use client";

import {
  useState,
} from "react";

import {
  ImportedTransaction,
} from "@/app/types/finance";


type Props = {
  transaction:
    ImportedTransaction | null;

  open: boolean;

  onClose: () => void;
  onUpdateTransaction: (
  transaction: ImportedTransaction
) => void;
};

import { supabase } from "@/lib/supabase";

import {
  canReviewTransactions,
  canClearEscalations,
  canAssignReviews,
  canEscalateTransactions,
} from "@/lib/auth/permissions";
import {
  determineWorkflowOwner,
} from "@/lib/workflows/routing";
import {
  applyWorkflowAutomation,
} from "@/lib/workflows/automation";
import {
  canModifyTransaction,
} from "@/lib/workflows/governance";
import {
  applyAllocation,
} from "@/lib/finance/allocation-resolution-engine";
import {
  generateAllocationSuggestions,
} from "@/lib/finance/allocation-suggestions";
import {
  canPostTransaction,
} from "@/lib/finance/posting-governance";
import {
  canFinalizeTransaction,
} from "@/lib/finance/finalization";
import {
  canAutoCompleteTransaction,
} from "@/lib/finance/completion";
import {
  isValidEntityAllocation,
} from "@/lib/governance/entity-validation";
import { useRouter } from "next/navigation";

export default function TransactionReviewPanel({
  transaction,
  open,
  onClose,
  onUpdateTransaction,
}: Props) {
  const [
  allocationAmount,
  setAllocationAmount,
] = useState("");
const router = useRouter(); 
const userRole = "finance_manager";
const [
  allocationCategoryInput,
  setAllocationCategoryInput,
] = useState("");
  if (
    !open ||
    !transaction
  ) {
    return null;
  }
  if (
  !canReviewTransactions(
    userRole
  )
) {

  return null;
}
const transactionLocked =
  !canModifyTransaction(
    transaction,
    userRole
  );
  const entityAllocationValid =
  isValidEntityAllocation(
    transaction
  );
  const allocationSuggestions =
  generateAllocationSuggestions(
    transaction
  );


  return (

  <div
    className="
      fixed
      inset-0
      z-40
      bg-black/40
      backdrop-blur-sm
    "
    onClick={onClose}
  >

    <div
    
  onClick={(event) =>
    event.stopPropagation()
  }
  className="
    fixed
    inset-y-0
    right-0
    z-50
    flex
    h-full
    w-full
    max-w-2xl
    flex-col
    border-l
    border-zinc-800
    bg-black
    shadow-2xl
  "

    >
<div
  className="
    flex-1
    overflow-y-auto
    p-8
  "
>
      <div className="flex items-start justify-between">

        <div>
          

          <p
            className="
              text-sm
              uppercase
              tracking-[0.25em]
              text-zinc-500
            "
          >
            Transaction Review
          </p>

          <h2
            className="
              mt-3
              text-3xl
              font-black
              text-white
            "
          >
            {transaction.description}
          </h2>

        </div>

        
      </div>

      <div
  className="
    flex-1
    overflow-y-auto
    space-y-5
    px-8
    py-6
  "
>

        <div
          className="
            rounded-3xl
            border
            border-zinc-800
            bg-zinc-900
            p-4
          "
        >

          <p className="text-sm text-zinc-500">
            Amount
          </p>

          <p
            className="
              mt-2
              text-3xl
              font-black
              text-white
            "
          >
            R
            {transaction.amount.toLocaleString()}
          </p>

        </div>

        <div
          className="
            rounded-3xl
            border
            border-zinc-800
            bg-zinc-900
            p-4
          "
        >

          <p className="text-sm text-zinc-500">
            Matched Tenant
          </p>
          
<div
  className="
    rounded-3xl
    border
    border-zinc-800
    bg-zinc-900
    p-6
  "
>

  <p
    className="
      text-sm
      text-zinc-500
    "
  >
    Match Intelligence
  </p>

  <div
    className="
      mt-5
      space-y-3
    "
  >

    {
      transaction.matchReasons?.map(
        (reason) => (

          <div
            key={reason}
            className="
              flex
              items-center
              gap-3
            "
          >

            <div
              className="
                h-2
                w-2
                rounded-full
                bg-green-400
              "
            />

            <p
              className="
                text-sm
                text-zinc-300
              "
            >
              {reason}
            </p>

          </div>

        )
      )
    }

  </div>

</div>
          <p
            className="
              mt-2
              text-xl
              font-semibold
              text-white
            "
          >
            {transaction.matchedTenant ||
              "No tenant match"}
          </p>

        </div>
        
{
  transaction.isSuspense && (

    <div
      className="
        rounded-3xl
        border
        border-orange-500/20
        bg-orange-500/[0.04]
        p-6
      "
    >

      <p
        className="
          text-sm
          text-orange-300
        "
      >
        Suspense Allocation
      </p>

      <p
        className="
          mt-3
          text-sm
          text-zinc-300
        "
      >
        This transaction has
        not yet been confidently
        allocated and requires
        suspense review.
      </p>

    </div>

  )
}

{
  true && (
    <div
      className="
        rounded-3xl
        border
        border-orange-500/20
        bg-orange-500/[0.04]
        p-6
      "
    >
      <p className="text-sm text-orange-300">
        Outstanding Allocation
      </p>
      <p className="mt-3 text-2xl font-black text-white">
        R{transaction.outstandingBalance?.toLocaleString()}
      </p>
      <p className="mt-3 text-sm text-zinc-300">
        This transaction requires manual allocation before it can be posted.
      </p>

      <button
        type="button"
        onClick={() => {
          const data = encodeURIComponent(JSON.stringify(transaction));
          router.push(`/financials/reconciliation/${transaction.id}?data=${data}`);
        }}
        className="
          mt-5
          w-full
          rounded-2xl
          bg-orange-500/20
          px-5
          py-4
          text-sm
          font-semibold
          text-orange-300
          transition
          hover:bg-orange-500/30
        "
      >
        Open Reconciliation Workspace
      </button>
    </div>
  )
}
<div
  className="
    rounded-3xl
    border
    border-zinc-800
    bg-zinc-900
    p-6
  "
>

  <p
    className="
      text-sm
      text-zinc-500
    "
  >
    Suggested Allocations
  </p>

  <div
    className="
      mt-5
      space-y-4
    "
  >

    {
      allocationSuggestions.map(
        (suggestion) => (

          <button
            key={
              suggestion.category
            }
            onClick={() => {

              const suggestedAmount =
                Number(
                  (
                    transaction.amount *
                    (
                      suggestion.percentage /
                      100
                    )
                  ).toFixed(2)
                );

              setAllocationCategoryInput(
                suggestion.category
              );

              setAllocationAmount(
                String(
                  suggestedAmount
                )
              );
            }}
            className="
              flex
              w-full
              items-center
              justify-between
              rounded-2xl
              border
              border-zinc-800
              px-4
              py-4
              text-left
              transition
              hover:border-zinc-600
            "
          >

            <div>

              <p
                className="
                  text-sm
                  font-semibold
                  text-white
                "
              >
                {
                  suggestion.category
                }
              </p>

              <p
                className="
                  mt-1
                  text-xs
                  text-zinc-500
                "
              >
                Suggested allocation
              </p>

            </div>

            <span
              className="
                rounded-full
                bg-blue-500/20
                px-3
                py-1
                text-xs
                font-semibold
                text-blue-300
              "
            >
              {
                suggestion.percentage
              }%
            </span>

          </button>

        )
      )
    }

  </div>

</div>


        <div
          className="
            rounded-3xl
            border
            border-zinc-800
            bg-zinc-900
            p-6
          "
        >

          <p className="text-sm text-zinc-500">
            Suggested Action
          </p>
          {
  transaction.requiresEscalation && (

    <div
      className="
        mt-6
        rounded-2xl
        border
        border-red-500/20
        bg-red-500/[0.04]
        p-5
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
        Escalation Reason
      </p>

      <p
        className="
          mt-3
          text-sm
          text-zinc-300
        "
      >
        High-value unmatched
        transaction requiring
        finance management
        review.
      </p>

    </div>

  )
}
<div
  className="
    mt-6
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
    Routing Decision
  </p>
  

  <p
    className="
      mt-3
      text-sm
      text-zinc-300
    "
  >
    {
      transaction.queue ===
      "escalated"
        ? "Escalated queue due to operational risk."
        : transaction.queue ===
          "review"
        ? "Sent for reconciliation review."
        : transaction.queue ===
          "ready"
        ? "Ready for operational posting."
        : "Transaction finalized."
    }
  </p>

</div>
          <div
  className="
    mt-6
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
    Priority
  </p>

  <div
    className="
      mt-3
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
            : "bg-zinc-700 text-zinc-300"
        }
      `}
    >

      {
        transaction.reviewPriority
      }

    </span>

  </div>

</div>
<div
  className="
    mt-6
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
    Assigned
  </p>

  <p
    className="
      mt-3
      text-sm
      text-white
    "
  >
    {
      transaction.assignedTo
    }
  </p>
  </div>
  <div
  className="
    mt-6
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
    Workflow Status
  </p>

  <div className="mt-3">

    <span
      className="
        rounded-full
        bg-blue-500/20
        px-3
        py-1
        text-xs
        font-semibold
        text-blue-300
      "
    >

      {
        transaction.workflowStatus
          ?.replaceAll(
            "_",
            " "
          )
      }

    </span>

  </div>

</div>
<div
  className="
    mt-6
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
    Posting Status
  </p>

  <div className="mt-3">

    <span
      className={`
        rounded-full
        px-3
        py-1
        text-xs
        font-semibold

       ${
  transaction.postingStatus ===
  "finalized"
    ? "bg-emerald-500/20 text-emerald-300"
    : transaction.postingStatus ===
      "posted"
    ? "bg-green-500/20 text-green-300"
    : transaction.postingStatus ===
      "approved"
    ? "bg-blue-500/20 text-blue-300"
    : "bg-zinc-700 text-zinc-300"
}
      `}
    >

      {
        transaction.postingStatus
      }

    </span>

  </div>

</div>
<div
  className="
    mt-6
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
    SLA Status
  </p>

  <div className="mt-3">

    <span
      className={`
        rounded-full
        px-3
        py-1
        text-xs
        font-semibold

        ${
          transaction.slaStatus ===
          "breached"
            ? "bg-red-500/20 text-red-300"
            : transaction.slaStatus ===
              "attention_required"
            ? "bg-orange-500/20 text-orange-300"
            : "bg-green-500/20 text-green-300"
        }
      `}
    >

      {
        transaction.slaStatus
          ?.replaceAll(
            "_",
            " "
          )
      }

    </span>

  </div>

</div>
{
  !entityAllocationValid && (

    <div
      className="
        rounded-3xl
        border
        border-red-500/20
        bg-red-500/[0.04]
        p-6
      "
    >

      <p
        className="
          text-sm
          font-semibold
          text-red-300
        "
      >
        Cross-Entity Allocation Blocked
      </p>

      <p
        className="
          mt-3
          text-sm
          text-zinc-300
        "
      >
        This transaction failed
        entity governance validation
        and cannot be posted.
      </p>

    </div>

  )
}


          <p
            className="
              mt-2
              text-xl
              font-semibold
              text-white
            "
          >
            {
              transaction.allocationAction
            }
          </p>

 
    {
  transactionLocked && (

    <div
      className="
        mt-4
        rounded-2xl
        border
        border-orange-500/20
        bg-orange-500/[0.04]
        p-4
      "
    >

      <p
        className="
          text-sm
          text-orange-300
        "
      >
        This transaction is
        governance locked and
        can no longer be modified.
      </p>

    </div>

  )
}
  
</div>
  <div
  
  className="
  sticky
  bottom-0
  z-50
  mt-8
  border-t
  border-zinc-800
  bg-black
  px-8
  py-6
"
>
  <div className="flex flex-wrap gap-4"> 
<button
  onClick={onClose}
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
  "
>
  Close Review
</button>
{
  !transactionLocked && (
    <button
    disabled={
  transactionLocked
}
    onClick={() => {
      

 const autoComplete =
  canAutoCompleteTransaction(
    transaction
  );

onUpdateTransaction({
  ...transaction,

  queue:
    autoComplete
      ? "posted"
      : "ready",

  status:
    "matched",

  workflowStatus:
    autoComplete
      ? "resolved"
      : "assigned",

  postingStatus:
    autoComplete
      ? "finalized"
      : "approved",

  activity: [
    ...(transaction.activity || []),

    {
      id: crypto.randomUUID(),

      label:
        autoComplete
          ? "Transaction auto-completed"
          : "Transaction approved",

      timestamp:
        new Date().toLocaleString(),
    },
  ],
});


}}
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
disabled={
  !entityAllocationValid
}
  disabled:cursor-not-allowed
disabled:opacity-40
        
      "
    >
      {
  canAutoCompleteTransaction(
    transaction
  )
    ? "Approve & Post"
    : "Approve Allocation"
}
      
    </button>
    
    )
}

{
  canFinalizeTransaction(
    transaction
  ) && (

    <button
      onClick={() => {

        onUpdateTransaction({
          ...transaction,

          postingStatus:
            "finalized",

          activity: [
            ...(transaction.activity || []),

            {
              id: crypto.randomUUID(),

              label:
                "Transaction finalized",

              timestamp:
                new Date().toLocaleString(),
            },
          ],
        });

      }}
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
      "
    >
      Finalize Transaction
    </button>

  )
}
 {
  canEscalateTransactions(
    userRole
  ) && (
    <button
    
    disabled={
  !canClearEscalations(
    userRole
  )
}
    onClick={() => {
     

  onUpdateTransaction(
  applyWorkflowAutomation({
    ...transaction,

    queue: "escalated",
    workflowStatus:
  "escalated",
  slaStatus:
  "breached",
  assignedTo:
  determineWorkflowOwner({
    ...transaction,

    requiresEscalation: true,

    slaStatus:
      "breached",
  }),
    

    requiresEscalation: true,
    activity: [
  ...(transaction.activity || []),

  {
    id: crypto.randomUUID(),

    label:
      "Transaction escalated",

    timestamp:
      new Date().toLocaleString(),
  },
],
  })
);

}}
      className="
        rounded-2xl
        bg-red-500/20
        px-5
        py-3
        text-sm
        font-semibold
        text-red-300
        transition
        hover:bg-red-500/30
        disabled:cursor-not-allowed
disabled:opacity-40
      "
    >
      Escalate Review
    </button>
    
    )
}
{
  canAssignReviews(
    userRole
  ) && (
    <button
    disabled={
  transactionLocked
}
    onClick={() => {

  onUpdateTransaction(
  applyWorkflowAutomation({
    ...transaction,
    workflowStatus:
  "assigned",

   assignedTo:
  determineWorkflowOwner({
    ...transaction,

    manualAllocation: true,
  }),
      activity: [
  ...(transaction.activity || []),

  {
    id: crypto.randomUUID(),
    

    label:
      "Finance review assigned",

    timestamp:
      new Date().toLocaleString(),
  },
],
  })
);

}}
      className="
        rounded-2xl
        bg-blue-500/20
        px-5
        py-3
        text-sm
        font-semibold
        text-blue-300
        transition
        hover:bg-blue-500/30
      "
    >
      Assign Finance Review
    </button>
    )
}
</div>
  </div>

</div>

        </div>
 </div>   
</div>
  );
}