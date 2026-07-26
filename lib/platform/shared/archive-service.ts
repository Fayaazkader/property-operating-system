export interface ArchiveResult {
  success: boolean;
  issues: Array<{ code: string; count: number; label: string }>;
}

export const archiveService = {
  async execute(
    canArchive: () => Promise<{ canArchive: boolean; issues: Array<{ code: string; count: number; label: string }> }>,
    doArchive: () => Promise<void>
  ): Promise<ArchiveResult> {
    const { canArchive, issues } = await canArchive();

    if (!canArchive) {
      return { success: false, issues };
    }

    await doArchive();

    return { success: true, issues: [] };
  }
};
