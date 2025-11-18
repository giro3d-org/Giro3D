/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import LayeredMaterial from './LayeredMaterial';
import MaterialUtils from './MaterialUtils';

export type ShadowMode = 'distance' | 'depth';

type LayeredMaterialConstructorParams = ConstructorParameters<typeof LayeredMaterial>[0];
interface ConstructorParams extends LayeredMaterialConstructorParams {
    source: LayeredMaterial;
    shadowMode: ShadowMode;
}

export default class ShadowLayeredMaterial extends LayeredMaterial {
    private readonly _shadowMode: ShadowMode;
    private readonly _source: LayeredMaterial;
    public readonly isMeshDistanceMaterial: boolean;
    public readonly isMeshDepthMaterial: boolean;

    public constructor(opts: ConstructorParams) {
        super(opts);

        this._source = opts.source;
        this._shadowMode = opts.shadowMode;
        this.isMeshDistanceMaterial = opts.shadowMode === 'distance';
        this.isMeshDepthMaterial = !this.isMeshDistanceMaterial;
        this.transparent = false;
        this.opacity = 1;

        MaterialUtils.setDefine(this, 'COLOR_RENDER', false);
        MaterialUtils.setDefine(this, 'STITCHING', false);

        switch (this._shadowMode) {
            case 'distance':
                MaterialUtils.setDefine(this, 'DISTANCE_RENDER', true);
                break;
            case 'depth':
                MaterialUtils.setDefine(this, 'DEPTH_RENDER', true);
                break;
        }
    }

    private copyElevationParameters(): void {
        const layer = this._source.getElevationLayer();
        if (layer) {
            const texture = this._source.getElevationTexture();
            if (texture) {
                const offsetScale = this._source.getElevationOffsetScale();
                this.setElevationTexture(layer, { texture, pitch: offsetScale });
            }
        } else {
            this.removeElevationLayer();
        }
    }

    public override onBeforeRender(): void {
        this.copyElevationParameters();
    }
}
