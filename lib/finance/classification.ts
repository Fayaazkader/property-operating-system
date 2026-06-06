export function classifyTransaction(
  description: string
) {

  const normalizedDescription =
    description.toLowerCase();

  if (
    normalizedDescription.includes(
      "insurance"
    )
  ) {

    return "Insurance Recovery";
  }

  if (
    normalizedDescription.includes(
      "deposit"
    )
  ) {

    return "Deposit";
  }

  if (
    normalizedDescription.includes(
      "rent"
    )
  ) {

    return "Tenant Rental";
  }

  return "Suspense Receipt";
}