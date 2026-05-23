type Trend = {
  metric: string;
  direction: string;
  value: string;
  color: string;
};

type Props = {
  trends: Trend[];
};

export default function PerformanceTrendAnalysis({
  trends,
}: Props) {

  return (

    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">

      <div className="flex items-center justify-between mb-8">

        <div>

          <h2 className="text-2xl font-bold text-black">
            Performance Trend Analysis
          </h2>

          <p className="text-zinc-500 mt-2">
            Strategic operational and portfolio performance momentum indicators.
          </p>

        </div>

        <span className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">

          Live Trend Monitoring

        </span>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {trends.map(
          (trend, index) => (

            <div
              key={index}
              className="rounded-2xl border border-zinc-200 p-6 hover:bg-zinc-50 transition"
            >

              <p className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-3">

                {trend.metric}

              </p>

              <div className="flex items-end justify-between">

                <div>

                  <p className={`text-3xl font-black ${trend.color}`}>

                    {trend.direction}

                  </p>

                  <p className="text-zinc-500 mt-2">

                    Momentum trend detected

                  </p>

                </div>

                <p className={`text-xl font-bold ${trend.color}`}>

                  {trend.value}

                </p>

              </div>

            </div>

          )
        )}

      </div>

    </div>

  );
}