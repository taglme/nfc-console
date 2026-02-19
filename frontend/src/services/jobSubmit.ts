import type { NewJob } from 'nfc-jsclient/dist/models/jobs';

import { getSdk } from './sdk';
import { enforceJobDraft, type JobDraft } from './capabilities';
import type { LicenseAccessResource } from 'nfc-jsclient/dist/models/license';
import { useRateLimitStore } from '../stores/rateLimit';

export type SubmitResult =
    | { ok: true; jobId: string }
    | {
          ok: false;
          error: string;
          errorKey?: string;
          errorParams?: Record<string, unknown>;
      };

export async function submitJob(params: {
    adapterId: string;
    jobName: string;
    expireAfter?: number;
    draft: JobDraft;
    access: LicenseAccessResource | null;
    onWarning?: (w: string) => void;
}): Promise<SubmitResult> {
    const expireAfter = params.expireAfter ?? 60;

    const enforced = enforceJobDraft(params.access, params.draft);
    if (!enforced.ok) {
        return { ok: false, error: enforced.error };
    }
    enforced.warnings.forEach(w => params.onWarning?.(w));

    const rateLimit = useRateLimitStore();
    const rateCheck = rateLimit.check(params.access?.create_job_rate_limit);
    if (!rateCheck.ok) {
        const seconds = Math.ceil(rateCheck.waitMs / 1000);
        return {
            ok: false,
            error: 'rate_limit',
            errorKey: 'errors.rateLimit',
            errorParams: { seconds },
        };
    }

    const job: NewJob = {
        job_name: params.jobName,
        repeat: enforced.job.repeat,
        expire_after: expireAfter,
        steps: enforced.job.steps as any,
    };

    const sdk = getSdk();
    await sdk.Jobs.deleteAll(params.adapterId);
    const created = await sdk.Jobs.add(params.adapterId, job);

    // record only after successful submission
    rateLimit.record();

    return { ok: true, jobId: created.jobID };
}
