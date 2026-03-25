/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { type BufferAttribute, type BufferGeometry, Object3D } from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

function createLabel(index: number, positions: BufferAttribute): CSS2DObject {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);

    const elt = document.createElement('div');
    elt.style.color = 'yellow';
    elt.innerText = `${index}`;
    const object = new CSS2DObject(elt);
    object.position.set(x, y, z);
    object.updateMatrixWorld(true);
    return object;
}

/**
 * Displays the indices of vertices as DOM elements.
 */
export class VertexIndexHelper extends Object3D {
    public constructor(geometry: BufferGeometry) {
        super();

        const positions = geometry.getAttribute('position') as BufferAttribute;

        for (let index = 0; index < positions.count; index++) {
            const label = createLabel(index, positions);
            this.add(label);
        }
    }
}

export default VertexIndexHelper;
