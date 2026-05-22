interface Column {
  key: string
  label: string
}

interface DataTableProps {
  columns: Column[]
  data: any[]
}

export default function DataTable({
  columns,
  data,
}: DataTableProps) {

  return (

    <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">

      <div className="overflow-x-auto">

        <table className="w-full">

          <thead className="bg-zinc-50 border-b border-zinc-200">

            <tr>

              {columns.map((column) => (

                <th
                  key={column.key}
                  className="
                    px-6
                    py-4
                    text-left
                    text-xs
                    font-bold
                    uppercase
                    tracking-[0.2em]
                    text-zinc-500
                  "
                >
                  {column.label}
                </th>

              ))}

            </tr>

          </thead>

          <tbody>

            {data.map((row, index) => (

              <tr
                key={index}
                className="
                  border-b
                  border-zinc-100
                  transition
                  hover:bg-zinc-50
                "
              >

                {columns.map((column) => (

                  <td
                    key={column.key}
                    className="
                      px-6
                      py-5
                      text-sm
                      text-zinc-700
                    "
                  >
                    {row[column.key]}
                  </td>

                ))}

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  )
}