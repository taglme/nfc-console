import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
    state: () => ({
        embeddedAppKey: '',
        embeddedAppKeyLoaded: false,
		ignoreHostLicense: false,
		ignoreHostLicenseLoaded: false,
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

        async loadDevFlags() {
            if (this.ignoreHostLicenseLoaded) return;

            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const api: any = await import('../../wailsjs/go/main/App');

            const v = (await api.GetIgnoreHostLicense?.()) ?? false;
            this.ignoreHostLicense = v === true;
            this.ignoreHostLicenseLoaded = true;
        },
    },
});
