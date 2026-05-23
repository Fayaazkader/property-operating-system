type Props = {
  insights: string[];
};

export default function ExecutiveInsights({
  insights,
}: Props) {

  return (

    <div className="bg-linear-to-br from-black to-zinc-800 rounded-2xl p-8 text-white shadow-sm">

      <div className="flex items-center justify-between mb-8">

        <div>

          <p className="text-sm uppercase tracking-[0.2em] text-zinc-400 mb-2">
            Executive Intelligence
          </p>

          <h2 className="text-3xl font-black">
            Operational Insights
          </h2>

        </div>

        <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">

          Live Analysis

        </div>

      </div>

      <div className="space-y-4">

        {insights.map(
          (insight, index) => (

            <div
              key={index}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >

              <p className="text-zinc-200 leading-7">

                {insight}

              </p>

            </div>

          )
        )}

      </div>

    </div>

  );
}