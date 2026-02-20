import { defineStore } from 'pinia';

const LS_KEY = 'taglme.console.settings.v1';

export type SettingsState = {
    baseUrl: string;
    locale: 'en' | 'ru';
    theme: 'light' | 'dark';
};

function loadSettings(): SettingsState {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return { baseUrl: 'http://127.0.0.1:3011', locale: 'en', theme: 'light' };
        const parsed = JSON.parse(raw) as Partial<SettingsState>;
        return {
            baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : 'http://127.0.0.1:3011',
            locale: parsed.locale === 'ru' ? 'ru' : 'en',
            theme: parsed.theme === 'dark' ? 'dark' : 'light',
        };
    } catch {
        return { baseUrl: 'http://127.0.0.1:3011', locale: 'en', theme: 'light' };
    }
}

export const useSettingsStore = defineStore('settings', {
    state: () => loadSettings(),

    actions: {
        setTheme(theme: 'light' | 'dark') {
            this.theme = theme;
            localStorage.setItem(LS_KEY, JSON.stringify(this.$state));
        },
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
