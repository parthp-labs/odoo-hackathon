// Inventory LLM agent — mode ladder + role ceilings.
// Modes are ordered levels of autonomy an agent may operate at.
// A role ceiling caps how high a given human role may escalate to.

export const LADDER = ['SAFE', 'REVIEW', 'AGENT'];

export const MAX_BY_ROLE = {
  admin: 'AGENT',
  inventory_manager: 'REVIEW',
  warehouse_staff: 'SAFE',
};

// 0-based index of a mode in the ladder; -1 when not a known mode.
export function level(m) {
  return LADDER.indexOf(m);
}

// The highest mode a role may reach; unknown roles default to 'SAFE'.
export function ceiling(role) {
  return MAX_BY_ROLE[role] || 'SAFE';
}

// May a role move from `current` (their current mode) to `target`?
// Staying at or descending to a lower mode is always allowed; escalation
// is only allowed if target stays within the role's ceiling.
export function canEscalateTo(current, target, role) {
  if (level(target) <= level(current)) return true;
  return level(target) <= level(ceiling(role));
}

// Highest agent mode level required to perform each action.
export const ACTION_MIN_LEVEL = {
  read: 0,
  create_draft: 0,
  validate: 1,
  cancel: 2,
};