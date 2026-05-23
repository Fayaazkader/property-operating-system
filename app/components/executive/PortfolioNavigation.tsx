"use client";
import { useState } from "react";
type Property = {
  name: string;
  occupancy: string;
  leases: number;
  risk: string;
};

type Portfolio = {
  portfolio: string;
  properties: Property[];
};

type Props = {
  portfolioHierarchy: Portfolio[];
};

export default function PortfolioNavigation({
  portfolioHierarchy,
}: Props) {

    const [expandedPortfolio, setExpandedPortfolio] =
  useState<string | null>(null);
  return (

    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">

      <div className="flex items-center justify-between mb-8">

        <div>

          <h2 className="text-2xl font-bold text-black">
            Portfolio Navigation
          </h2>

          <p className="text-zinc-500 mt-2">
            Hierarchical portfolio and property operational navigation.
          </p>

        </div>

        <span className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">

          Enterprise Structure

        </span>

      </div>

      <div className="space-y-4">

        {portfolioHierarchy.map(
          (portfolio, index) => (

            <div
              key={index}
              className="rounded-2xl border border-zinc-200 overflow-hidden"
            >

              <div
  onClick={() =>
    setExpandedPortfolio(
      expandedPortfolio === portfolio.portfolio
        ? null
        : portfolio.portfolio
    )
  }
  className="flex cursor-pointer items-center justify-between bg-zinc-50 px-6 py-5 hover:bg-zinc-100 transition"
>

                <div>

                  <p className="flex items-center gap-3 text-lg font-bold text-black">

  <span className="text-sm">

    {expandedPortfolio === portfolio.portfolio
      ? "▼"
      : "▶"}

  </span>

  {portfolio.portfolio}

</p>

                  <p className="text-sm text-zinc-500 mt-1">

                    {portfolio.properties.length} Properties

                  </p>

                </div>

                <button className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 transition">

                  View Portfolio

                </button>

              </div>

            {expandedPortfolio === portfolio.portfolio && (

  <div className="divide-y divide-zinc-100">

    {portfolio.properties.map(
      (property, propertyIndex) => (

        <div
          key={propertyIndex}
          className="flex items-center justify-between px-6 py-4 hover:bg-zinc-50 transition"
        >

          <div className="flex items-center gap-3">

            <span className="text-zinc-400">
              ↳
            </span>

            <div>

  <p className="font-medium text-black">

    {property.name}

  </p>

  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">

    <span>
      Occupancy: {property.occupancy}
    </span>

    <span>
      Leases: {property.leases}
    </span>

    <span
      className={`rounded-full px-2 py-1 font-semibold
      ${
        property.risk === "Critical"
          ? "bg-red-100 text-red-700"
          : property.risk === "Moderate"
          ? "bg-orange-100 text-orange-700"
          : "bg-green-100 text-green-700"
      }`}
    >

      {property.risk}

    </span>

  </div>

</div>

          </div>

          <button className="text-sm font-semibold text-zinc-600 hover:text-black transition">

            Open Workspace

          </button>

        </div>

      )
    )}

  </div>

)}

            </div>

          )
        )}

      </div>

    </div>

  );
}