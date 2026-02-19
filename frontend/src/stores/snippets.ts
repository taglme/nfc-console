import { defineStore } from 'pinia';

import { getSdk } from '../services/sdk';

import { SnippetCategory } from 'nfc-jsclient/dist/models/snippets';
import type { Snippet } from 'nfc-jsclient/dist/client/snippets';

export type SnippetKind = 'tag' | 'adapter';

function toCategory(kind: SnippetKind): SnippetCategory {
    return kind === 'tag' ? SnippetCategory.TagSnippet : SnippetCategory.AdapterSnippet;
}

export const useSnippetsStore = defineStore('snippets', {
    state: () => ({
        tag: [] as Snippet[],
        adapter: [] as Snippet[],
        loading: false,
        error: '' as string,
        loaded: {
            tag: false,
            adapter: false,
        },
    }),

    actions: {
        reset() {
            this.tag = [];
            this.adapter = [];
            this.loading = false;
            this.error = '';
            this.loaded = { tag: false, adapter: false };
        },

        async refresh(kind: SnippetKind) {
            this.loading = true;
            this.error = '';
            try {
                const sdk = getSdk();
                const list = await sdk.Snippets.getFiltered({ category: toCategory(kind) } as any);

                if (kind === 'tag') {
                    this.tag = list;
                    this.loaded.tag = true;
                } else {
                    this.adapter = list;
                    this.loaded.adapter = true;
                }
            } catch (e) {
                this.error = e instanceof Error ? e.message : String(e);
                if (kind === 'tag') {
                    this.tag = [];
                    this.loaded.tag = false;
                } else {
                    this.adapter = [];
                    this.loaded.adapter = false;
                }
            } finally {
                this.loading = false;
            }
        },

        async ensureLoaded(kind: SnippetKind) {
            if (this.loaded[kind]) return;
            await this.refresh(kind);
        },
    },
});
