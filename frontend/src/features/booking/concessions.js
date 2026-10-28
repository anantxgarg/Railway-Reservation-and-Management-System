import { useEffect, useState } from 'react';
import { api } from '../../api';

// The concessions a passenger can be booked with: the shared concession_rule
// table, served by Team 4's payments app. Loaded once per page load.
let rules = null;

export function useConcessionRules() {
  const [list, setList] = useState(rules || []);
  useEffect(() => {
    if (!rules) {
      rules = api.getConcessionRules().catch(() => {
        rules = null; // payments app down: offer none, try again next time
        return [];
      });
    }
    let current = true;
    Promise.resolve(rules).then((data) => current && setList(data));
    return () => {
      current = false;
    };
  }, []);
  return list;
}

export const concessionLabel = (rule) =>
  `${rule.name} (${rule.discountType === 'PERCENTAGE' ? `${Number(rule.discountValue)}% off` : `₹${rule.discountValue} off`})`;

/** Why a passenger of this age can't have the concession, or null if they can. */
export function ageProblem(rule, age) {
  if (age === '' || age == null) return null;
  const n = Number(age);
  if (rule.minAge != null && n < rule.minAge) return `from age ${rule.minAge}`;
  if (rule.maxAge != null && n > rule.maxAge) return `up to age ${rule.maxAge}`;
  return null;
}
