import { defineStore } from 'pinia';

const LS_KEY = 'taglme.console.settings.v1';

export type SettingsState = {
    baseUrl: string;
    locale: 'en' | 'ru';
};

function loadSettings(): SettingsState {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return { baseUrl: 'http://127.0.0.1:3011', locale: 'en' };
        const parsed = JSON.parse(raw) as Partial<SettingsState>;
        return {
            baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : 'http://127.0.0.1:3011',
            locale: parsed.locale === 'ru' ? 'ru' : 'en',
        };
    } catch {
        return { baseUrl: 'http://127.0.0.1:3011', locale: 'en' };
    }
}

export const useSettingsStore = defineStore('settings', {
    state: () => loadSettings(),

    actions: {
        setBaseUrl(baseUrl: string) {
            this.baseUrl = baseUrl;
            localStorage.setItem(LS_KEY, JSON.stringify(this.$state));
        },
        setLocale(locale: 'en' | 'ru') {
            this.locale = locale;
            localStorage.setItem(LS_KEY, JSON.stringify(this.$state));
        },
    },
});
