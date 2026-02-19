import { watch } from 'vue';

import { useRunsStore } from '../stores/runs';
import { useWsStore } from '../stores/ws';

let started = false;

export function startWsBridge() {
    if (started) return;
    started = true;

    const ws = useWsStore();
    const runs = useRunsStore();

    watch(
        () => ws.lastEvent,
        ev => {
            if (!ev) return;
            runs.ingestWsEvent(ev);
        },
        { deep: false },
    );
}
