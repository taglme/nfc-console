import { defineStore } from 'pinia';
import type { Event } from 'nfc-jsclient/dist/client/events';

import { getSdk, getSdkKey } from '../services/sdk';
import { useSettingsStore } from './settings';

export const useWsStore = defineStore('ws', {
    state: () => ({
        connected: false,
        connecting: false,
        lastError: '' as string,
        lastEvent: null as Event | null,
        handlersInitialized: false,
        sdkKey: '' as string,
        syncTimer: 0 as any,
    }),

    actions: {
        initHandlers() {
            const currentKey = getSdkKey();
            if (this.handlersInitialized && this.sdkKey === currentKey) return;

            // SDK identity changed → drop previous state
            if (this.handlersInitialized && this.sdkKey !== currentKey) {
                this.disconnect();
                this.lastEvent = null;
                this.lastError = '';
                this.handlersInitialized = false;
            }

            const sdk = getSdk();

            sdk.Ws.onEvent(e => {
                this.lastEvent = e;
            });

            sdk.Ws.onError(err => {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes('undefined. Reason: undefined') || msg.includes('connection refused')) {
                    this.lastError = 'CONNECT_REFUSED';
                } else {
                    this.lastError = msg;
                }
                this.connecting = false;
            });

            this.handlersInitialized = true;
            this.sdkKey = currentKey;
        },

        reset() {
            this.disconnect();
            this.connected = false;
            this.connecting = false;
            this.lastError = '';
            this.lastEvent = null;
            this.handlersInitialized = false;
            this.sdkKey = '';
        },

        connect() {
            const sdk = getSdk();
            this.lastError = '';
            this.connecting = true;
            this.initHandlers();
            sdk.Ws.connect();

            // ws open is async; keep syncing until it becomes OPEN or we disconnect
            this.connected = false;
            if (this.syncTimer) {
                clearInterval(this.syncTimer);
                this.syncTimer = 0;
            }
            this.syncTimer = setInterval(() => {
                const wasConnected = this.connected;
                this.connected = sdk.Ws.isConnected();

                if (this.connected && !wasConnected) {
                    try {
                        const settings = useSettingsStore();
                        sdk.Ws.setLocale(settings.locale);
                    } catch (e) {
                        console.error('Failed to sync ws locale on connect', e);
                    }
                }

                if (this.connected) this.connecting = false;
            }, 250);
        },

        disconnect() {
            const sdk = getSdk();
            sdk.Ws.disconnect();
            this.connected = false;
            this.connecting = false;

            if (this.syncTimer) {
                clearInterval(this.syncTimer);
                this.syncTimer = 0;
            }
        },

        syncConnected() {
            const sdk = getSdk();
            this.connected = sdk.Ws.isConnected();
            if (this.connected) this.connecting = false;
        },
    },
});
