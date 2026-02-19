import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
    state: () => ({
        embeddedAppKey: '',
        embeddedAppKeyLoaded: false,
    }),

    actions: {
        async loadEmbeddedAppKey() {
            if (this.embeddedAppKeyLoaded) return;

            // We import lazily so the project still type-checks before Wails bindings are regenerated.
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const api = await import('../../wailsjs/go/main/App');

            const key = (await api.GetEmbeddedAppKey?.()) ?? '';
            this.embeddedAppKey = typeof key === 'string' ? key : '';
            this.embeddedAppKeyLoaded = true;
        },
    },
});
