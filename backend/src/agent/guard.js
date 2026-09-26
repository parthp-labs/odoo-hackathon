import { ACTION_MIN_LEVEL, level, ceiling } from './modes.js';

// Raised when an action request must be refused; the loop maps this to a refusal.
export class ForbiddenActionError extends Error {}

// Decide whether `role` may perform `action` while the agent is in `mode`.
// The action requires the agent mode level to meet the action minimum AND the
// role's ceiling to permit that level.
export function authorize({ action, mode, role }) {
  const min = ACTION_MIN_LEVEL[action];
  if (min === undefined) throw new Error(`unknown action ${action}`);
  const modeLevel = level(mode);
  const capLevel = level(ceiling(role));
  return modeLevel >= min && capLevel >= min;
}