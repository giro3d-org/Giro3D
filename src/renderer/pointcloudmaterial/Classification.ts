/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { ColorRepresentation, Texture } from 'three';

import { Color, DataTexture } from 'three';

/**
 * Parameters for a point cloud classification.
 */
export class Classification {
    /**
     * The color of this classification.
     */
    public color: Color;
    /**
     * Toggles the visibility of points with this classification.
     */
    public visible: boolean;

    public constructor(color: ColorRepresentation, visible = true) {
        this.color = new Color(color);
        this.visible = visible;
    }

    /**
     * Clones this classification.
     * @returns The cloned object.
     */
    public clone(): Classification {
        return new Classification(this.color.clone(), this.visible);
    }
}

/**
 * A set of 256 pre-defined classifications following the ASPRS scheme, with pre-defined colors for
 * classifications 0 to 18. The remaining classifications have the default color (#FF8100)
 *
 * See https://www.asprs.org/wp-content/uploads/2010/12/LAS_Specification.pdf
 */
export const ASPRS_CLASSIFICATIONS: Classification[] = new Array(256);

const DEFAULT_CLASSIFICATION = new Classification(0xff8100);

for (let i = 0; i < ASPRS_CLASSIFICATIONS.length; i++) {
    ASPRS_CLASSIFICATIONS[i] = DEFAULT_CLASSIFICATION.clone();
}

ASPRS_CLASSIFICATIONS[0] = new Classification('#858585'); // Created, never classified
ASPRS_CLASSIFICATIONS[1] = new Classification('#bfbfbf'); // Unclassified
ASPRS_CLASSIFICATIONS[2] = new Classification('#834000'); // Ground
ASPRS_CLASSIFICATIONS[3] = new Classification('#008100'); // Low vegetation
ASPRS_CLASSIFICATIONS[4] = new Classification('#00bf00'); // Medium vegetation
ASPRS_CLASSIFICATIONS[5] = new Classification('#00ff00'); // High vegetation
ASPRS_CLASSIFICATIONS[6] = new Classification('#0081c1'); // Building
ASPRS_CLASSIFICATIONS[7] = new Classification('#ff0000'); // Low point (noise)
ASPRS_CLASSIFICATIONS[8] = DEFAULT_CLASSIFICATION.clone(); // Reserved
ASPRS_CLASSIFICATIONS[9] = new Classification('#0000ff'); // Water
ASPRS_CLASSIFICATIONS[10] = new Classification('#606d73'); // Rail
ASPRS_CLASSIFICATIONS[11] = new Classification('#858585'); // Road surface
ASPRS_CLASSIFICATIONS[12] = DEFAULT_CLASSIFICATION.clone(); // Reserved
ASPRS_CLASSIFICATIONS[13] = new Classification('#ede440'); // Wire - Guard (Shield)
ASPRS_CLASSIFICATIONS[14] = new Classification('#ed6840'); // Wire - Conductor (Phase)
ASPRS_CLASSIFICATIONS[15] = new Classification('#29fff8'); // Transmission Tower
ASPRS_CLASSIFICATIONS[16] = new Classification('#5e441d'); // Wire Structure connector (e.g Insulator)
ASPRS_CLASSIFICATIONS[17] = new Classification('#7992c7'); // Bridge Deck
ASPRS_CLASSIFICATIONS[18] = new Classification('#cd27d6'); // High Noise

export class ClassificationsTexture {
    public static readonly maxCount = 256;

    public classifications: Classification[];
    public readonly texture: Texture;

    private readonly _array: Uint8Array; // = new Uint8Array(4 * ClassificationsTexture.maxCount);

    public constructor() {
        this.classifications = ASPRS_CLASSIFICATIONS.map(c => c.clone());
        this._array = new Uint8Array(4 * ClassificationsTexture.maxCount);
        this.texture = new DataTexture(
            this._array as BufferSource,
            ClassificationsTexture.maxCount,
            1,
        );
    }

    public updateUniform(): void {
        this.sanitizeClassifications();

        const temp = new Uint8Array(4);
        for (let i = 0; i < ClassificationsTexture.maxCount; i++) {
            const classification = this.classifications[i] ?? DEFAULT_CLASSIFICATION;
            temp[0] = 255 * classification.color.r;
            temp[1] = 255 * classification.color.g;
            temp[2] = 255 * classification.color.b;
            temp[3] = classification.visible ? 255 : 0;

            let classifChanged = false;
            const classifOffset = 4 * i;
            for (let j = 0; j < 4; j++) {
                if (this._array[classifOffset + j] !== temp[j]) {
                    classifChanged = true;
                    break;
                }
            }
            if (classifChanged) {
                this._array.set(temp, classifOffset);
                this.texture.needsUpdate = true;
            }
        }
    }

    public dispose(): void {
        this.texture.dispose();
    }

    private sanitizeClassifications(): void {
        if (this.classifications.length > ClassificationsTexture.maxCount) {
            this.classifications = this.classifications.slice(0, ClassificationsTexture.maxCount);
            console.warn(
                `The provided classification array has been truncated to ${ClassificationsTexture.maxCount} elements`,
            );
        } else {
            while (this.classifications.length < ClassificationsTexture.maxCount) {
                this.classifications.push(DEFAULT_CLASSIFICATION.clone());
            }
        }
    }
}
