import { defineStore } from 'pinia';
import type { HostPolicyResource } from 'nfc-jsclient/dist/models/license';
import type { License } from 'nfc-jsclient/dist/client/license';

import { getSdk } from '../services/sdk';

export const useLicenseStore = defineStore('license', {
    state: () => ({
        license: null as License | null,
        loading: false,
        error: '' as string,
        fetchedAt: 0 as number,
    }),

    getters: {
        hostTier: s => s.license?.hostTier ?? 'community',
        nfcdPolicy: s => (s.license?.policies?.nfcd as HostPolicyResource | undefined) ?? null,
        capabilities: s => (s.license?.policies?.nfcd as any)?.job_capabilities ?? null,
        constraints: s => (s.license?.policies?.nfcd as any)?.create_job_constraints ?? null,
        rateLimit: s => (s.license?.policies?.nfcd as any)?.create_job_rate_limit ?? null,
        allowedScopes: s => (s.license?.policies?.nfcd as any)?.allowed_scopes ?? [],

        // Derived access-like payload used by submit/enforcement logic.
        // This intentionally mirrors the previous `/licenses/access` shape,
        // but it is computed locally from the active license policy.
        access: s => {
            const nfcd = (s.license?.policies?.nfcd as any) ?? null;
            if (!nfcd) return null;

            const constraints = (nfcd.create_job_constraints as any) ?? null;
            const allowed_scopes = (nfcd.allowed_scopes as any) ?? constraints?.allowed_scopes ?? [];
            const allowed_command_scopes = constraints?.allowed_command_scopes ?? [];

            return {
                allowed_scopes,
                allowed_command_scopes,
                create_job_rate_limit: nfcd.create_job_rate_limit ?? null,
                job_capabilities: nfcd.job_capabilities ?? null,
                create_job_constraints: constraints,
            };
        },
    },

    actions: {
        async refreshAccess() {
            this.loading = true;
            this.error = '';
            try {
                const sdk = getSdk();
                this.license = await sdk.Licenses.getAccess();
                this.fetchedAt = Date.now();
            } catch (e) {
                this.error = e instanceof Error ? e.message : String(e);
                this.license = null;
            } finally {
                this.loading = false;
            }
        },
    },
});
