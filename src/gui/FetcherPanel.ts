/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import type Instance from '../core/Instance';

import Fetcher from '../utils/Fetcher';
import Panel from './Panel';

class FetcherPanel extends Panel {
    public pendingRequests = 0;
    public runningRequests = 0;
    public completedRequests = 0;

    public constructor(parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Fetcher');
        this.updateValues();
        this.addController(this, 'pendingRequests').name('Pending requests');
    }

    public override updateValues(): void {
        const { pending } = Fetcher.getInfo();
        this.pendingRequests = pending;
    }
}

export default FetcherPanel;
