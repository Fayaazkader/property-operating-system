type Priority = {
  level: string;
  message: string;
  color: string;
};

type Props = {
  priorities: Priority[];
};

export default function ExecutivePriorities({
  priorities,
}: Props) {

  return (

    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 mb-6">

      <div className="flex items-center justify-between mb-8">

        <div>

          <h2 className="text-2xl font-bold text-black">
            Executive Priorities
          </h2>

          <p className="text-zinc-500 mt-2">
            Immediate operational focus areas requiring executive attention.
          </p>

        </div>

        <span className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">

          {priorities.length} Active

        </span>

      </div>

      <div className="space-y-4">

        {priorities.map(
          (priority, index) => (

            <div
              key={index}
              className={`rounded-2xl border p-5 ${priority.color}`}
            >

              <p className="text-xs font-black uppercase tracking-[0.2em] mb-2">

                {priority.level}

              </p>

              <p className="font-semibold">

                {priority.message}

              </p>

            </div>

          )
        )}

      </div>

    </div>

  );
}