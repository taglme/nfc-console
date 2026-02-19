import type { LicenseAccessResource } from 'nfc-jsclient/dist/models/license';

export type JobDraft = {
    repeat: number;
    steps: Array<{ command: string; params: unknown }>; // params are API-defined
};

export type EnforcementResult =
    | { ok: true; job: JobDraft; warnings: string[] }
    | { ok: false; error: string };

function numOrNull(v: number | null | undefined): number | null {
    if (v === null || v === undefined) return null;
    if (Number.isFinite(v)) return v;
    return null;
}

export function enforceJobDraft(access: LicenseAccessResource | null | undefined, draft: JobDraft): EnforcementResult {
    const warnings: string[] = [];
    const job: JobDraft = {
        repeat: Math.max(0, Math.trunc(draft.repeat ?? 0)),
        steps: Array.isArray(draft.steps) ? draft.steps.map(s => ({ command: String(s.command), params: s.params })) : [],
    };

    const caps = access?.job_capabilities;
    const constraints = access?.create_job_constraints;

    if (caps?.allow_multistep === false && job.steps.length > 1) {
        return {
            ok: false,
            error: 'This host license does not allow multi-step jobs.',
        };
    }

    if (caps?.allow_repeat === false && job.repeat > 1) {
        job.repeat = 1;
        warnings.push('Repeat is not allowed on this host license. Set to 1.');
    }

    const maxRepeat = numOrNull(constraints?.max_repeat);
    if (maxRepeat !== null && job.repeat > maxRepeat) {
        job.repeat = maxRepeat;
        warnings.push(`Repeat is limited by license. Clamped to ${maxRepeat}.`);
    }

    const maxSteps = numOrNull(constraints?.max_steps);
    if (maxSteps !== null && job.steps.length > maxSteps) {
        // safest behavior is to block rather than silently drop commands
        return {
            ok: false,
            error: `This host license limits job steps to ${maxSteps}.`,
        };
    }

    const allowedCommands = constraints?.allowed_command_scopes;
    if (Array.isArray(allowedCommands) && allowedCommands.length > 0) {
        const notAllowed = job.steps.filter(s => !allowedCommands.includes(s.command)).map(s => s.command);
        if (notAllowed.length > 0) {
            return {
                ok: false,
                error: `This host license does not allow command(s): ${Array.from(new Set(notAllowed)).join(', ')}.`,
            };
        }
    }

    return { ok: true, job, warnings };
}
