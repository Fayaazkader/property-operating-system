type Action = {
  title: string;
  description: string;
};

type Props = {
  actions: Action[];
};

export default function RecommendedActions({
  actions,
}: Props) {

  return (

    <div className="bg-linear-to-br from-blue-950 via-black to-zinc-900 rounded-2xl p-8 text-white shadow-sm">

      <div className="flex items-center justify-between mb-8">

        <div>

          <p className="text-sm uppercase tracking-[0.2em] text-blue-300 mb-2">
            AI Operational Guidance
          </p>

          <h2 className="text-3xl font-black">
            Recommended Executive Actions
          </h2>

        </div>

        <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">

          Intelligence Recommendations

        </span>

      </div>

      <div className="space-y-4">

        {actions.map(
          (action, index) => (

            <div
              key={index}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >

              <p className="text-xl font-bold mb-3">

                {action.title}

              </p>

              <p className="text-zinc-300 leading-7">

                {action.description}

              </p>

            </div>

          )
        )}

      </div>

    </div>

  );
}