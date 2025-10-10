import { bold, cyan, bgBlack, white, red } from 'picocolors'

// 1. Define Reusable Styles
// A reusable function that applies multiple styles: bold + cyan color.
const highlight = (text: string) => bold(cyan(text))

// A reusable function for a title block: bold, white text on black background.
const titleBlock = (text: string) => bold(bgBlack(white(` ${text} `)))

// A reusable function for an error title.
const errorBlock = (text: string) => bold(bgBlack(red(` ✗ ${text} `)))

export { highlight, titleBlock, errorBlock }
