"use client";

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

export default function TransactionReviewPanel({
  transaction,
  open,
  onClose,
  onUpdateTransaction,
}: Props) {
  if (
    !open ||
    !transaction
  ) {
    return null;
  }

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
        w-full
        max-w-2xl
        overflow-y-auto
        border-l
        border-zinc-800
        bg-black
        p-8
        shadow-2xl
        
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
    mt-10
    space-y-8
    pb-40
  "
>

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
            Amount
          </p>

          <p
            className="
              mt-2
              text-4xl
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
            p-6
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
      space-y-4
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
  {
  transaction.manualAllocation && (

    <div
      className="
        mt-6
        rounded-2xl
        border
        border-zinc-800
        bg-zinc-900/60
        p-5
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
        Manual Allocation
      </p>

      <p
        className="
          mt-3
          text-sm
          text-zinc-300
        "
      >
        No automatic tenant
        allocation was found.
        This transaction requires
        manual allocation review.
      </p>

      <button
        type="button"
        className="
          mt-5
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
        Allocate Manually
      </button>

    </div>

  )
}

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
          </div>

  <p className="text-sm text-zinc-500">
    Workflow Actions
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

  <p className="text-sm text-zinc-500">
    Activity Timeline
  </p>

  <div className="mt-6 space-y-6">

   {
  transaction.activity?.map(
    (activity) => (

      <div
        key={activity.id}
        className="flex gap-4"
      >

        <div
          className="
            mt-2
            h-3
            w-3
            rounded-full
            bg-blue-400
          "
        />

        <div>

          <p className="text-sm text-white">

            {activity.label}

          </p>

          <p className="mt-1 text-xs text-zinc-500">

            {activity.timestamp}

          </p>

        </div>

      </div>

    )
  )
}

    

  </div>

</div>

  <div
  className="
  sticky
  bottom-[-2rem]
  left-0
  right-0
  mt-10
  flex
  flex-wrap
  gap-4
  border-t
  border-zinc-800
  bg-black
  px-8
  py-6
"
>
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
    <button
    onClick={() => {

  onUpdateTransaction({
    ...transaction,

    queue: "ready",

    status: "matched",

    requiresEscalation: false,
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
      Approve Allocation
      
    </button>

    <button
    onClick={() => {

  onUpdateTransaction({
    ...transaction,

    queue: "escalated",

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
  });

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
      "
    >
      Escalate Review
    </button>

    <button
    onClick={() => {

  onUpdateTransaction({
    ...transaction,

    assignedTo:
      "Finance Manager",
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
  });

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

  </div>

</div>

        </div>
 </div>

  );
}