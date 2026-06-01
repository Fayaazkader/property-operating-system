type TurnoverRentalInput = {
  tenantTurnover: number;
  turnoverRate: number;
  baseRental: number;
};

export function calculateTurnoverRental({
  tenantTurnover,
  turnoverRate,
  baseRental,
}: TurnoverRentalInput) {
  const turnoverRental =
    tenantTurnover *
    (turnoverRate / 100);

  const totalRental =
    baseRental +
    turnoverRental;

  return {
    tenantTurnover,
    turnoverRate,
    baseRental,
    turnoverRental:
      Number(
        turnoverRental.toFixed(2)
      ),
    totalRental:
      Number(
        totalRental.toFixed(2)
      ),
  };
}