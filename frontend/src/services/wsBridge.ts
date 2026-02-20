import { watch } from 'vue';

import { useRunsStore } from '../stores/runs';
import { useWsStore } from '../stores/ws';
import { useJobModalStore } from '../stores/jobModal';

let started = false;

export function startWsBridge() {
    if (started) return;
    started = true;

    const ws = useWsStore();
    const runs = useRunsStore();
    const jobModal = useJobModalStore();

    watch(
        () => ws.lastEvent,
        ev => {
            if (!ev) return;
            runs.ingestWsEvent(ev);
            jobModal.ingestWsEvent(ev);
        },
        { deep: false },
    );
}
