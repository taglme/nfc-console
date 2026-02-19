import { defineStore } from 'pinia';
import type { Adapter } from 'nfc-jsclient/dist/client/adapters';

import { getSdk } from '../services/sdk';

const LS_KEY = 'taglme.console.selectedAdapterId.v1';

export const useAdaptersStore = defineStore('adapters', {
    state: () => ({
        list: [] as Adapter[],
        loading: false,
        error: '' as string,
        selectedAdapterId: (localStorage.getItem(LS_KEY) || '') as string,
    }),

    getters: {
        selectedAdapter: s => s.list.find(a => a.adapterId === s.selectedAdapterId) ?? null,
        options: s =>
            s.list.map(a => ({
                label: `${a.name} (${a.kind})`,
                value: a.adapterId,
            })),
    },

    actions: {
        async refresh() {
            this.loading = true;
            this.error = '';
            try {
                const sdk = getSdk();
                this.list = await sdk.Adapters.getAll();
                if (this.selectedAdapterId && !this.list.some(a => a.adapterId === this.selectedAdapterId)) {
                    this.selectedAdapterId = '';
                    localStorage.removeItem(LS_KEY);
                }
            } catch (e) {
                this.error = e instanceof Error ? e.message : String(e);
                this.list = [];
            } finally {
                this.loading = false;
            }
        },

        select(adapterId: string) {
            this.selectedAdapterId = adapterId;
            if (adapterId) {
                localStorage.setItem(LS_KEY, adapterId);
            } else {
                localStorage.removeItem(LS_KEY);
            }
        },
    },
});
