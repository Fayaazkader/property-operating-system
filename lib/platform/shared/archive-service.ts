export interface ArchiveResult {
  success: boolean;
  issues: Array<{ code: string; count: number; label: string }>;
}

export const archiveService = {
  async execute(
    checkArchive: () => Promise<{ canArchive: boolean; issues: Array<{ code: string; count: number; label: string }> }>,
    performArchive: () => Promise<void>
  ): Promise<ArchiveResult> {
    const { canArchive, issues } = await checkArchive();

    if (!canArchive) {
      return { success: false, issues };
    }

    await performArchive();

    return { success: true, issues: [] };
  }
};
