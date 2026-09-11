export class DocumentEntity {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly description: string | null,
    public readonly content: string,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
  ) {}
}
