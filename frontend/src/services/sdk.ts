import NfcClient from 'nfc-jsclient';
import { useAppStore } from '../stores/app';
import { useSettingsStore } from '../stores/settings';

let client: NfcClient | null = null;
let clientKey = '';

export function getSdk(): NfcClient {
    const settings = useSettingsStore();
    const app = useAppStore();

    const key = JSON.stringify({ baseUrl: settings.baseUrl, locale: settings.locale, appKey: app.embeddedAppKey });
    if (client && clientKey === key) return client;

    clientKey = key;

    client = new NfcClient(settings.baseUrl, settings.locale, app.embeddedAppKey);
    return client;
}

export function getSdkKey(): string {
    // Ensure the cached key matches how getSdk() decides whether to recreate.
    const settings = useSettingsStore();
    const app = useAppStore();
    return JSON.stringify({ baseUrl: settings.baseUrl, locale: settings.locale, appKey: app.embeddedAppKey });
}

export function resetSdk() {
    client = null;
    clientKey = '';
}
