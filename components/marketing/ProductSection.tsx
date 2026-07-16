import ScreenshotFrame from "@/components/ui/ScreenshotFrame";

interface ProductSectionProps {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  reverse?: boolean;
}

export default function ProductSection({
  eyebrow,
  title,
  description,
  image,
  reverse = false,
}: ProductSectionProps) {
  return (
    <section className="py-36">

      <div
        className={`mx-auto grid max-w-7xl items-center gap-24 px-6 lg:grid-cols-2 ${
          reverse ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >

        <div>

          <p className="text-sm uppercase tracking-[0.35em] text-zinc-500">

            {eyebrow}

          </p>

          <h2 className="mt-6 text-5xl font-semibold tracking-[-0.04em] text-white">

            {title}

          </h2>

          <p className="mt-8 text-lg leading-9 text-zinc-400">

            {description}

          </p>

        </div>

        <ScreenshotFrame
          src={image}
          alt={title}
        />

      </div>

    </section>
  );
}
