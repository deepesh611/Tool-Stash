export class DuplicateToolError extends Error {
  id: number

  constructor(message: string, id: number) {
    super(message)
    this.name = 'DuplicateToolError'
    this.id = id
  }
}
