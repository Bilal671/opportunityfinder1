import { store } from '../database/store';

export type QuotaAction = 'search' | 'audit' | 'ai_analysis' | 'export';

export class QuotaService {
  canPerform(workspaceId: string, action: QuotaAction, count = 1): { allowed: boolean; message?: string } {
    const quota = store.getQuota(workspaceId);

    switch (action) {
      case 'search':
        if (quota.searchesCount + count > quota.maxSearches) {
          return {
            allowed: false,
            message: `Search limit reached (${quota.searchesCount}/${quota.maxSearches} for current billing period). Upgrade to Pro or Agency for higher limits.`,
          };
        }
        break;

      case 'audit':
        if (quota.auditsCount + count > quota.maxAudits) {
          return {
            allowed: false,
            message: `Website audit limit reached (${quota.auditsCount}/${quota.maxAudits}). Upgrade plan to perform additional audits.`,
          };
        }
        break;

      case 'ai_analysis':
        if (quota.aiAnalysesCount + count > quota.maxAiAnalyses) {
          return {
            allowed: false,
            message: `AI analysis limit reached (${quota.aiAnalysesCount}/${quota.maxAiAnalyses}). Upgrade to continue AI analysis.`,
          };
        }
        break;

      case 'export':
        if (quota.exportsCount + count > quota.maxExports) {
          return {
            allowed: false,
            message: `CSV export limit reached (${quota.exportsCount}/${quota.maxExports}). Upgrade plan for unlimited exports.`,
          };
        }
        break;
    }

    return { allowed: true };
  }

  recordUsage(workspaceId: string, action: QuotaAction, count = 1) {
    const quota = store.getQuota(workspaceId);
    switch (action) {
      case 'search':
        store.updateQuota(workspaceId, { searchesCount: quota.searchesCount + count });
        break;
      case 'audit':
        store.updateQuota(workspaceId, { auditsCount: quota.auditsCount + count });
        break;
      case 'ai_analysis':
        store.updateQuota(workspaceId, { aiAnalysesCount: quota.aiAnalysesCount + count });
        break;
      case 'export':
        store.updateQuota(workspaceId, { exportsCount: quota.exportsCount + count });
        break;
    }
  }
}

export const quotaService = new QuotaService();
