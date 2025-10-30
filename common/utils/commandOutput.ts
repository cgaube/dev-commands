export class CommandOutput {
  constructor(private content: string) {}

  toJson(): any {
    try {
      return JSON.parse(this.content)
    } catch {
      // fallback: return as string if not valid JSON
      return this.content
    }
  }

  toArray(): string[] {
    return this.content.split(/\r?\n/)
  }

  toString(): string {
    return this.content
  }
}
