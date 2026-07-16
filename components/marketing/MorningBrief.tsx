import ScreenshotFrame from "@/components/ui/ScreenshotFrame";
import Section from "@/components/ui/Section";

export default function MorningBrief() {
  return (
    <Section id="platform" className="pt-40">

      <div className="grid items-center gap-24 lg:grid-cols-2">

        <div>

          <p className="text-sm uppercase tracking-[0.35em] text-zinc-500">

            Morning Brief

          </p>

          <h2 className="mt-6 text-5xl font-semibold tracking-tight text-white">

            Start every day
            knowing exactly
            what matters.

          </h2>

          <p className="mt-8 text-lg leading-9 text-zinc-400">

            Morning Brief replaces dashboards with operational intelligence.

            Revenue.

            Risk.

            Tasks.

            Activity.

            Recommendations.

            Delivered before you ask.

          </p>

        </div>

        <ScreenshotFrame
          src="/screenshots/morning-brief.png"
          alt="Morning Brief"
        />

      </div>

    </Section>
  );
}
