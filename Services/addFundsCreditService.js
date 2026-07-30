/** Fixed ₹1 discount on add-funds: gateway charge and balance credit = entered − ₹1. */
const FIXED_DISCOUNT_RUPEES = 1;
const FIXED_DISCOUNT_PAISA = 100;

function computeAddFundsCredit(enteredRupees) {
  const entered = Number(enteredRupees);
  if (!Number.isFinite(entered) || entered <= FIXED_DISCOUNT_RUPEES) {
    throw new Error('Invalid amount for add-funds credit calculation');
  }

  const creditRupees = Math.round((entered - FIXED_DISCOUNT_RUPEES) * 100) / 100;

  return {
    creditRupees,
    deductionPaisa: FIXED_DISCOUNT_PAISA,
    creditPaise: Math.round(creditRupees * 100),
  };
}

module.exports = {
  computeAddFundsCredit,
  FIXED_DISCOUNT_RUPEES,
};
