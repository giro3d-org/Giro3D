import type GUI from 'lil-gui';
import type Instance from '../core/Instance';
import Fetcher from '../utils/Fetcher';
import Panel from './Panel';

class FetcherPanel extends Panel {
    pendingRequests = 0;
    runningRequests = 0;
    completedRequests = 0;

    constructor(parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Fetcher');
        this.updateValues();
        this.addController(this, 'pendingRequests').name('Pending requests');
    }

    updateValues() {
        const { pending } = Fetcher.getInfo();
        this.pendingRequests = pending;
    }
}

export default FetcherPanel;
