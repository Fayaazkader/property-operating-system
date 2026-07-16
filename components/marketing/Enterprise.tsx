import Section from "@/components/ui/Section";

const items = [
  {
    title: "Operational Intelligence",
    text: "Morning Brief surfaces the information that matters before users begin their day.",
  },
  {
    title: "Workflow Automation",
    text: "Every operational event naturally progresses to the next business process until human judgement is required.",
  },
  {
    title: "Financial Platform",
    text: "Operational events automatically become financial events, creating a connected operational and accounting platform.",
  },
  {
    title: "Enterprise Security",
    text: "Role-based permissions, approvals, audit history and complete traceability are built into every workflow.",
  },
];

export default function Enterprise() {
  return (
    <Section id="enterprise">

      <div className="mx-auto max-w-4xl text-center">

        <p className="text-sm uppercase tracking-[0.35em] text-zinc-500">

          Enterprise Platform

        </p>

        <h2 className="mt-8 text-6xl font-semibold tracking-[-0.05em] text-white">

          One platform.

          <br />

          Every workflow connected.

        </h2>

        <p className="mx-auto mt-10 max-w-3xl text-xl leading-9 text-zinc-400">

          AssetFlow was designed as an operating system,
          not a collection of modules.
          Every workflow shares the same data,
          permissions,
          approvals,
          automation
          and financial intelligence.

        </p>

      </div>

      <div className="mx-auto mt-24 grid max-w-7xl gap-8 md:grid-cols-2">

        {items.map((item) => (

          <div
            key={item.title}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-10"
          >

            <h3 className="text-2xl font-semibold text-white">

              {item.title}

            </h3>

            <p className="mt-6 leading-8 text-zinc-400">

              {item.text}

            </p>

          </div>

        ))}

      </div>

    </Section>
  );
}
