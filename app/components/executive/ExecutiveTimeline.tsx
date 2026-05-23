type Activity = {
  id: string;
  activity_type: string;
  activity_note: string;
  created_at: string;
  lease_id: string;
  created_by: string;
};

type Props = {
  activities: Activity[];
};

export default function ExecutiveTimeline({
  activities,
}: Props) {

  return (

    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">

      <div className="flex items-center justify-between mb-8">

        <div>

          <h2 className="text-2xl font-bold text-black">
            Executive Timeline
          </h2>

          <p className="text-zinc-500 mt-2">
            Chronological operational activity and executive event visibility.
          </p>

        </div>

        <span className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">

          Live Feed

        </span>

      </div>

      <div className="space-y-6">

        {activities?.map((activity) => (

          <div
            key={activity.id}
            className="flex gap-5"
          >

            <div className="flex flex-col items-center">

              <div className="h-4 w-4 rounded-full bg-black" />

              <div className="w-px flex-1 bg-zinc-200 mt-2" />

            </div>

            <div className="pb-6">

              <div className="flex flex-wrap items-center gap-3 mb-2">

                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-zinc-700">

                  {activity.activity_type}

                </span>

                <span className="text-sm text-zinc-500">

                  {new Date(
                    activity.created_at
                  ).toLocaleString()}

                </span>

              </div>

              <p className="font-semibold text-black mb-2">

                {activity.activity_note}

              </p>

              <p className="text-sm text-zinc-500">

                Lease: {activity.lease_id}
                {" • "}
                By: {activity.created_by}

              </p>

            </div>

          </div>

        ))}

      </div>

    </div>

  );
}