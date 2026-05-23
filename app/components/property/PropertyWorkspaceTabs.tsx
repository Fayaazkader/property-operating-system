"use client";

import { useState } from "react";
import Link from "next/link";

const tabs = [
  "Overview",
  "Leases",
  "Documents",
  "Tasks",
  "Activity",
];

export default function PropertyWorkspaceTabs() {

  const [activeTab, setActiveTab] =
    useState("Overview");

  return (

    <div className="space-y-6">

      <div className="flex flex-wrap gap-3">

        {tabs.map((tab) => (

          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-xl px-5 py-3 text-sm font-semibold transition
            ${
              activeTab === tab
                ? "bg-black text-white"
                : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
            }`}
          >

            {tab}

          </button>

        ))}

      </div>

      <div className="rounded-2xl bg-white border border-zinc-200 p-8">

        {activeTab === "Overview" && (

  <div className="space-y-4">

    <h2 className="text-2xl font-bold text-black">
      Operational Overview
    </h2>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

      <div className="rounded-2xl bg-zinc-100 p-5">

        <p className="text-sm text-zinc-500 mb-2">
          Occupancy
        </p>

        <p className="text-3xl font-black text-green-600">
          92%
        </p>

      </div>

      <div className="rounded-2xl bg-zinc-100 p-5">

        <p className="text-sm text-zinc-500 mb-2">
          Active Leases
        </p>

        <p className="text-3xl font-black">
          18
        </p>

      </div>

      <div className="rounded-2xl bg-zinc-100 p-5">

        <p className="text-sm text-zinc-500 mb-2">
          Risk Status
        </p>

        <p className="text-3xl font-black text-orange-500">
          Moderate
        </p>

      </div>

    </div>

  </div>

)}

{activeTab === "Leases" && (

  <div className="space-y-4">

    <div className="flex items-center justify-between">

      <h2 className="text-2xl font-bold text-black">
        Lease Workspace
      </h2>

      <button className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">

        Create Lease

      </button>

    </div>

    <div className="space-y-3">

     <Link
  href="/leases/test"
  className="block rounded-2xl border border-zinc-200 p-5 hover:bg-zinc-50 transition"
>

  <div className="flex items-center justify-between">

    <div>

      <p className="font-bold text-black">
        Corporate HQ Lease
      </p>

      <p className="text-sm text-zinc-500 mt-1">
        Expiry: December 2027
      </p>

    </div>

    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">

      Stable

    </span>

  </div>

</Link>

      <div className="rounded-2xl border border-zinc-200 p-5">

        <div className="flex items-center justify-between">

          <div>

            <p className="font-bold text-black">
              Logistics Operations
            </p>

            <p className="text-sm text-zinc-500 mt-1">
              Expiry: March 2026
            </p>

          </div>

          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">

            Renewal Risk

          </span>

        </div>

      </div>

    </div>

  </div>

)}

{activeTab === "Documents" && (

  <div className="space-y-4">

    <div className="flex items-center justify-between">

      <h2 className="text-2xl font-bold text-black">
        Document Center
      </h2>

      <button className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">

        Upload Document

      </button>

    </div>

    <div className="space-y-3">

      <div className="rounded-2xl border border-zinc-200 p-4">

        <p className="font-semibold text-black">
          Master Lease Agreement.pdf
        </p>

      </div>

      <div className="rounded-2xl border border-zinc-200 p-4">

        <p className="font-semibold text-black">
          Insurance Schedule.pdf
        </p>

      </div>

      <div className="rounded-2xl border border-zinc-200 p-4">

        <p className="font-semibold text-black">
          Operational Compliance.pdf
        </p>

      </div>

    </div>

  </div>

)}

{activeTab === "Tasks" && (

  <div className="space-y-4">

    <h2 className="text-2xl font-bold text-black">
      Operational Tasks
    </h2>

    <div className="space-y-3">

      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 p-4">

        <p className="font-medium text-black">
          Lease escalation review
        </p>

        <span className="text-sm font-bold text-orange-600">
          Pending
        </span>

      </div>

      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 p-4">

        <p className="font-medium text-black">
          Tenant compliance audit
        </p>

        <span className="text-sm font-bold text-green-600">
          Complete
        </span>

      </div>

    </div>

  </div>

)}

{activeTab === "Activity" && (

  <div className="space-y-4">

    <h2 className="text-2xl font-bold text-black">
      Activity Timeline
    </h2>

    <div className="space-y-4">

      <div className="rounded-2xl border border-zinc-200 p-4">

        <p className="font-semibold text-black">
          Lease renewal discussion initiated.
        </p>

        <p className="text-sm text-zinc-500 mt-2">
          2 hours ago
        </p>

      </div>

      <div className="rounded-2xl border border-zinc-200 p-4">

        <p className="font-semibold text-black">
          Updated insurance documentation uploaded.
        </p>

        <p className="text-sm text-zinc-500 mt-2">
          Yesterday
        </p>

      </div>

    </div>

  </div>

)}

      </div>

    </div>

  );
}