import Section from "@/components/ui/Section";

const plans = [
  {
    title: "Growth",
    leases: "1–100",
    price: "R3,000",
  },
  {
    title: "Professional",
    leases: "101–250",
    price: "R5,500",
  },
  {
    title: "Business",
    leases: "251–500",
    price: "R9,500",
  },
  {
    title: "Enterprise",
    leases: "501–1,000",
    price: "R16,000",
  },
];

export default function Pricing() {
  return (
    <Section>

      <div className="mx-auto max-w-4xl text-center">

        <p className="text-sm uppercase tracking-[0.35em] text-zinc-500">

          Pricing

        </p>

        <h2 className="mt-8 text-6xl font-semibold text-white">

          Scales with your portfolio.

        </h2>

      </div>

      <div className="mx-auto mt-24 grid max-w-7xl gap-8 lg:grid-cols-4">

        {plans.map((plan) => (

          <div
            key={plan.title}
            className="rounded-3xl border border-white/10 p-10"
          >

            <h3 className="text-2xl font-semibold text-white">

              {plan.title}

            </h3>

            <p className="mt-4 text-zinc-500">

              {plan.leases} leases

            </p>

            <p className="mt-12 text-5xl font-semibold text-white">

              {plan.price}

            </p>

            <p className="mt-2 text-zinc-500">

              per month

            </p>

          </div>

        ))}

      </div>

    </Section>
  );
}
