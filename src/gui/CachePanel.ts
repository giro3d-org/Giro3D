/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import type Instance from '../core/Instance';

import { GlobalCache } from '../core/Cache';
import Panel from './Panel';

class CachePanel extends Panel {
    public count: string;
    public size: string;
    public ttl: number;
    public capacityMb: number;
    public capacityEntries: number;

    public constructor(parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Cache');

        this.count = '?';
        this.size = '?';
        this.ttl = GlobalCache.defaultTtl / 1000;
        this.capacityMb = GlobalCache.maxSize / 1024 / 1024;
        this.capacityEntries = GlobalCache.capacity;

        this.addController(GlobalCache, 'enabled').name('Enable cache');
        this.addController(this, 'ttl')
            .name('Default TTL (seconds)')
            .min(1)
            .max(3600)
            .onChange(v => {
                this.ttl = Math.floor(v);
                GlobalCache.defaultTtl = this.ttl * 1000;
            });
        this.addController(this, 'capacityMb')
            .name('Capacity (MB)')
            .min(2)
            .max(1024)
            .onChange(v => {
                this.capacityMb = Math.floor(v);
                // GlobalCache.maxSize = this.capacityMb * 1024 * 1024;
            });
        this.addController(this, 'capacityEntries')
            .name('Capacity (entries)')
            .min(0)
            .max(16000)
            .onChange(v => {
                this.capacityEntries = Math.floor(v);
                // GlobalCache.capacity = this.capacityEntries;
            });
        this.addController(this, 'count').name('Entries');
        this.addController(this, 'size').name('Memory usage (approx)');
        this.addController(this, 'purge').name('Purge stale entries');
        this.addController(this, 'clear').name('Clear the cache');
        this.addController(this, 'dump').name('Dump cache to console');
    }

    public purge(): void {
        GlobalCache.purge();
        this.update();
    }

    public dump(): void {
        console.log([...GlobalCache.entries()]);
    }

    public clear(): void {
        GlobalCache.clear();
        this.update();
    }

    public override updateValues(): void {
        this.count = `${GlobalCache.count} / ${GlobalCache.capacity}`;

        const used = (GlobalCache.size / 1024 / 1024).toFixed(1);
        const maxSize = (GlobalCache.maxSize / 1024 / 1024).toFixed(1);
        this.size = `${used} MB / ${maxSize} MB`;
    }
}

export default CachePanel;
