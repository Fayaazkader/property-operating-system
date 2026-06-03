"use client";

import {
  ImportedTransaction,
} from "@/app/types/finance";

type Props = {
  transaction:
    ImportedTransaction | null;

  open: boolean;

  onClose: () => void;
};

export default function TransactionReviewPanel({
  transaction,
  open,
  onClose,
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

        <button
          onClick={onClose}
          className="
            rounded-xl
            border
            border-zinc-700
            px-4
            py-2
            text-sm
            text-zinc-400
            transition
            hover:border-zinc-500
            hover:text-white
          "
        >
          Close
        </button>

      </div>

      <div className="mt-10 space-y-8">

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

    {[
      {
        id: "1",
        label:
          "Transaction imported",

        timestamp:
          "2 mins ago",
      },

      {
        id: "2",
        label:
          "Tenant match detected",

        timestamp:
          "1 min ago",
      },

      {
        id: "3",
        label:
          "Allocation recommendation generated",

        timestamp:
          "Just now",
      },
    ].map((activity) => (

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

    ))}

  </div>

</div>

  <div className="mt-6 flex flex-wrap gap-4">

    <button
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

    </div>
  );
}