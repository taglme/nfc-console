import { defineStore } from 'pinia';
import type { Event } from 'nfc-jsclient/dist/client/events';

import { getSdk, getSdkKey } from '../services/sdk';

export const useWsStore = defineStore('ws', {
    state: () => ({
        connected: false,
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
                this.lastError = err instanceof Error ? err.message : String(err);
            });

            this.handlersInitialized = true;
            this.sdkKey = currentKey;
        },

        reset() {
            this.disconnect();
            this.connected = false;
            this.lastError = '';
            this.lastEvent = null;
            this.handlersInitialized = false;
            this.sdkKey = '';
        },

        connect() {
            const sdk = getSdk();
            this.lastError = '';
            this.initHandlers();
            sdk.Ws.connect();

            // ws open is async; keep syncing until it becomes OPEN or we disconnect
            this.connected = false;
            if (this.syncTimer) {
                clearInterval(this.syncTimer);
                this.syncTimer = 0;
            }
            this.syncTimer = setInterval(() => {
                this.connected = sdk.Ws.isConnected();
            }, 250);
        },

        disconnect() {
            const sdk = getSdk();
            sdk.Ws.disconnect();
            this.connected = false;

            if (this.syncTimer) {
                clearInterval(this.syncTimer);
                this.syncTimer = 0;
            }
        },

        syncConnected() {
            const sdk = getSdk();
            this.connected = sdk.Ws.isConnected();
        },
    },
});
