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
        this.addController<number>(this, 'pendingRequests').name('Pending requests');
        this.addController<number>(this, 'runningRequests').name('Running requests');
        this.addController<number>(this, 'completedRequests').name('Completed requests');
    }

    updateValues() {
        const { pending, running, complete } = Fetcher.getInfo();
        this.pendingRequests = pending;
        this.runningRequests = running;
        this.completedRequests = complete;
    }
}

export default FetcherPanel;
