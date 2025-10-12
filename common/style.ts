import * as picocolors from 'picocolors'
import { createColorize } from 'colorize-template'
import { intro } from '@clack/prompts'

type ColorName = keyof typeof picocolors

// Use colorize template
// colorize`Is red {red color} text`
const colorize = createColorize({
  ...picocolors,
  success: picocolors.green,
  error: picocolors.red,
})

// Re-usable Styles
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
  const styledInto = colorize`{bgGreen.black ${text}}`
  return intro(styledInto)
}

export { picocolors as color, picocolors, colorize, pill, introTitle }
