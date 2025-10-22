import * as picocolors from 'picocolors'
import { createColorize } from 'colorize-template'
import { intro, log, cancel, isCancel } from '@clack/prompts'

type ColorName = keyof typeof picocolors & string

// Use colorize template
const colorize = createColorize({
  ...picocolors,
  success: picocolors.green,
  error: picocolors.red,
})

// @note uses nf-ple-left_half_circle_thick nf-ple-right_half_circle_thick from nerdfont compatible fonts
const pill = (
  text: string,
  bgColor: ColorName,
  textColor: ColorName = 'black',
): string => {
  let bgColorKey: ColorName
  let borderColorKey: ColorName

  if (bgColor.startsWith('bg')) {
    bgColorKey = bgColor
    borderColorKey = bgColor.slice(2).toLowerCase() as ColorName
  } else {
    bgColorKey =
      `bg${bgColor.charAt(0).toUpperCase() + bgColor.slice(1)}` as ColorName
    borderColorKey = bgColor
  }

  return colorize`{${borderColorKey} \ue0b6}{${bgColorKey}.${textColor} ${text}}{${borderColorKey} \ue0b4}`
}

const introTitle = (text: string) => {
  const styledInto = pill(text, 'white', 'black')
  return intro(styledInto)
}

/**
 * Exit the program with a red error message and code 1
 */
const exitWithError = (message: string) => {
  log.error(picocolors.red(message))
  cancel()
  process.exit(1)
}

/**
 * Exit with code 0 with a cancel message
 */
const exitWithCancel = (message: string = 'Operation cancelled.') => {
  cancel(message)
  process.exit(0)
}

/**
 * Check if choice is cancel and exit if it is
 */
export function exitOnCancel(choice: any) {
  if (isCancel(choice)) {
    exitWithCancel()
  }
}

export {
  picocolors as colors,
  picocolors,
  colorize,
  pill,
  introTitle,
  exitWithError,
  exitWithCancel,
}
