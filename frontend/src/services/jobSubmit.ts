import type { NewJob } from 'nfc-jsclient/dist/models/jobs';

import { getSdk } from './sdk';
import { enforceJobDraft, type AccessLike, type JobDraft } from './capabilities';
import { useRateLimitStore } from '../stores/rateLimit';
import { useAppStore } from '../stores/app';

function hasScope(scopes: string[] | null | undefined, required: string): boolean {
    const req = String(required ?? '').trim().toLowerCase();
    if (!req) return false;

    for (const raw of scopes ?? []) {
        const s = String(raw ?? '').trim().toLowerCase();
        if (!s) continue;

        if (s === req || s === '*') return true;
        // Prefix wildcard: "job:*" matches "job:delete".
        if (s.endsWith(':*')) {
            const prefix = s.slice(0, -1); // keep ':'
            if (req.startsWith(prefix)) return true;
        }
    }
    return false;
}

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
    access: AccessLike | null;
    onWarning?: (w: string) => void;
}): Promise<SubmitResult> {
    const expireAfter = params.expireAfter ?? 60;

    // Ensure X-App-Key is loaded (Wails binding) before any API calls.
    // Without it, the server may respond 401/403 and the browser may surface it as a generic "Network error".
    const app = useAppStore();
    await app.loadEmbeddedAppKey();
    await app.loadDevFlags();

    // Dev escape hatch: ignore host license constraints on the client side.
    // This does NOT bypass server-side checks; pair with nfcd insecure mode if needed.
    const effectiveAccess = app.ignoreHostLicense ? null : params.access;

    const enforced = enforceJobDraft(effectiveAccess, params.draft);
    if (!enforced.ok) {
        return { ok: false, error: enforced.error };
    }
    enforced.warnings.forEach(w => params.onWarning?.(w));

    const rateLimit = useRateLimitStore();
	if (!app.ignoreHostLicense) {
		const rateCheck = rateLimit.check(params.access?.create_job_rate_limit ?? undefined);
		if (!rateCheck.ok) {
			const seconds = Math.ceil(rateCheck.waitMs / 1000);
			return {
				ok: false,
				error: 'rate_limit',
				errorKey: 'errors.rateLimit',
				errorParams: { seconds },
			};
		}
	}

    const job: NewJob = {
        job_name: params.jobName,
        repeat: enforced.job.repeat,
        expire_after: expireAfter,
        steps: enforced.job.steps as any,
    };

    const sdk = getSdk();

    // Clearing the job queue requires `job:delete` scope.
    // Many licenses allow job creation but do not allow deletion.
    // In that case, skip queue cleanup instead of failing the primary action.
    if (hasScope(params.access?.allowed_scopes, 'job:delete')) {
        await sdk.Jobs.deleteAll(params.adapterId);
    }
    const created = await sdk.Jobs.add(params.adapterId, job);

    // record only after successful submission
    if (!app.ignoreHostLicense) {
        rateLimit.record();
    }

    return { ok: true, jobId: created.jobID };
}
