export type StyleInput = {
  time: number
  dx: number
  dy: number
  nx: number
  ny: number
  dist: number
  radiusX: number
  radiusY: number
}

export type StyleIntensityFn = (input: StyleInput) => number
