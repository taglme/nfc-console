import { describe, expect, it } from 'vitest';

import { enforceJobDraft, type JobDraft } from './capabilities';
import type { LicenseAccessResource } from 'nfc-jsclient/dist/models/license';

function access(partial: Partial<LicenseAccessResource>): LicenseAccessResource {
    return partial as LicenseAccessResource;
}

describe('enforceJobDraft', () => {
    it('blocks multi-step jobs when allow_multistep=false', () => {
        const a = access({
            job_capabilities: { allow_multistep: false, allow_repeat: true, allow_batch: true },
        });

        const draft: JobDraft = {
            repeat: 1,
            steps: [
                { command: 'get_tags', params: {} },
                { command: 'read_ndef', params: {} },
            ],
        };

        const res = enforceJobDraft(a, draft);
        expect(res.ok).toBe(false);
        if (res.ok) throw new Error('expected blocked');
        expect(res.error).toContain('multi-step');
    });

    it('clamps repeat to 1 when allow_repeat=false', () => {
        const a = access({
            job_capabilities: { allow_repeat: false, allow_multistep: true, allow_batch: true },
        });

        const draft: JobDraft = {
            repeat: 10,
            steps: [{ command: 'get_tags', params: {} }],
        };

        const res = enforceJobDraft(a, draft);
        expect(res.ok).toBe(true);
        if (!res.ok) throw new Error('expected ok');
        expect(res.job.repeat).toBe(1);
        expect(res.warnings.length).toBeGreaterThan(0);
    });

    it('clamps repeat to max_repeat when specified', () => {
        const a = access({
            create_job_constraints: { max_repeat: 3 },
        });

        const draft: JobDraft = {
            repeat: 10,
            steps: [{ command: 'get_tags', params: {} }],
        };

        const res = enforceJobDraft(a, draft);
        expect(res.ok).toBe(true);
        if (!res.ok) throw new Error('expected ok');
        expect(res.job.repeat).toBe(3);
        expect(res.warnings.some(w => w.includes('Clamped') || w.includes('clamped'))).toBe(true);
    });

    it('does not clamp repeat when max_repeat=0 (unlimited)', () => {
        const a = access({
            create_job_constraints: { max_repeat: 0 },
        });

        const draft: JobDraft = {
            repeat: 10,
            steps: [{ command: 'get_tags', params: {} }],
        };

        const res = enforceJobDraft(a, draft);
        expect(res.ok).toBe(true);
        if (!res.ok) throw new Error('expected ok');
        expect(res.job.repeat).toBe(10);
        expect(res.warnings.length).toBe(0);
    });

    it('blocks when steps exceed max_steps', () => {
        const a = access({
            create_job_constraints: { max_steps: 1 },
        });

        const draft: JobDraft = {
            repeat: 1,
            steps: [
                { command: 'get_tags', params: {} },
                { command: 'read_ndef', params: {} },
            ],
        };

        const res = enforceJobDraft(a, draft);
        expect(res.ok).toBe(false);
        if (res.ok) throw new Error('expected blocked');
        expect(res.error).toContain('limits job steps');
    });

    it('does not block when max_steps=0 (unlimited)', () => {
        const a = access({
            create_job_constraints: { max_steps: 0 },
        });

        const draft: JobDraft = {
            repeat: 1,
            steps: [
                { command: 'get_tags', params: {} },
                { command: 'read_ndef', params: {} },
            ],
        };

        const res = enforceJobDraft(a, draft);
        expect(res.ok).toBe(true);
    });

    it('blocks when a command is not in allowed_command_scopes', () => {
        const a = access({
            create_job_constraints: {
                allowed_command_scopes: ['get_tags'],
            },
        });

        const draft: JobDraft = {
            repeat: 1,
            steps: [
                { command: 'get_tags', params: {} },
                { command: 'read_ndef', params: {} },
            ],
        };

        const res = enforceJobDraft(a, draft);
        expect(res.ok).toBe(false);
        if (res.ok) throw new Error('expected blocked');
        expect(res.error).toContain('does not allow command');
        expect(res.error).toContain('read_ndef');
    });

    it('accepts allowed_command_scopes in "command:<name>" form', () => {
        const a = access({
            create_job_constraints: {
                allowed_command_scopes: ['command:get_tags', 'command:read_ndef'],
            },
        });

        const draft: JobDraft = {
            repeat: 1,
            steps: [
                { command: 'get_tags', params: {} },
                { command: 'read_ndef', params: {} },
            ],
        };

        const res = enforceJobDraft(a, draft);
        expect(res.ok).toBe(true);
    });
});
