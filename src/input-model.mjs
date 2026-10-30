export const INPUT_KEYS = [
  'left', 'right', 'up', 'down', 'block', 'light', 'medium', 'heavy',
  'special', 'super', 'tag', 'assist', 'dash', 'dodge', 'throw', 'parry',
  'awaken', 'start',
]

export const PRESS_KEYS = [
  'up', 'down', 'left', 'right', 'light', 'medium', 'heavy', 'special', 'super', 'tag', 'assist',
  'dash', 'dodge', 'throw', 'parry', 'awaken', 'start',
]

export function blankInput() {
  const input = { pressed: {} }
  for (const key of INPUT_KEYS) input[key] = false
  return input
}

export function normalizeInput(raw) {
  const input = blankInput()
  if (!raw) return input
  for (const key of INPUT_KEYS) input[key] = !!raw[key]
  if (raw.pressed) for (const key of PRESS_KEYS) input.pressed[key] = !!raw.pressed[key]
  return input
}

export function cloneInput(input) {
  return normalizeInput(input)
}

export function pressed(input, key) {
  return !!(input && input.pressed && input.pressed[key])
}
