type BreadcrumbItem = {

  label: string;

};

type Props = {

  items: BreadcrumbItem[];

};

export default function Breadcrumbs({
  items,
}: Props) {

  return (

    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-zinc-500">

      {items.map(
        (item, index) => (

          <div
            key={item.label}
            className="flex items-center gap-3"
          >

            <span
              className={
                index ===
                items.length - 1
                  ? "font-semibold text-white"
                  : ""
              }
            >

              {item.label}

            </span>

            {index !==
              items.length - 1 && (

              <span className="text-zinc-700">

                →

              </span>

            )}

          </div>

        )

      )}

    </div>

  );
}