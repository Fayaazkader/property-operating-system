type MetricWidgetProps = {
  title: string;
  value: string | number;
  subtitle?: string;
};

export default function MetricWidget({
  title,
  value,
  subtitle,
}: MetricWidgetProps) {
  return (
    <div className="
      rounded-3xl
      border
      border-zinc-800
      bg-zinc-900
      p-6
    ">
      <p className="
        text-xs
        uppercase
        tracking-[0.2em]
        text-zinc-500
      ">
        {title}
      </p>

      <h2 className="
        mt-4
        text-4xl
        font-black
        text-white
      ">
        {value}
      </h2>

      {subtitle && (
        <p className="
          mt-3
          text-sm
          text-zinc-400
        ">
          {subtitle}
        </p>
      )}
    </div>
  );
}