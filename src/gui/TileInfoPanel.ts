/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import { Color, Group, Vector2, Vector3 } from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import type Instance from '../core/Instance';
import type Map from '../entities/Map';
import type TileMesh from '../entities/tiles/TileMesh';

import Ellipsoid from '../core/geographic/Ellipsoid';
import Panel from './Panel';

const tmpVec2 = new Vector2();

function createTileLabel(): HTMLDivElement {
    const text = document.createElement('div');

    text.style.color = '#FFFFFF';
    text.style.padding = '0.2em 1em';
    text.style.textShadow = '2px 2px 2px black';
    text.style.textAlign = 'center';
    text.style.fontSize = '12px';
    text.style.backgroundColor = 'rgba(0,0,0,0.5)';

    return text;
}

const tmpLines: string[] = [];

class TileInfoPanel extends Panel {
    private readonly _labels: globalThis.Map<number, CSS2DObject> = new globalThis.Map();
    private readonly _map: Map;
    private readonly _root = new Group();

    public readonly params: {
        enabled: boolean;
        nodeInfo: boolean;
        imageSize: boolean;
        minMax: boolean;
        layerInfo: boolean;
        color: Color;
    } = {
        enabled: false,
        nodeInfo: true,
        imageSize: true,
        layerInfo: false,
        minMax: false,
        color: new Color('yellow'),
    };

    /**
     * @param map - The map.
     * @param parentGui - Parent GUI
     * @param instance - The instance
     */
    public constructor(map: Map, parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Tile info');

        this._map = map;

        this.addController(this.params, 'enabled')
            .name('Show tile info')
            .onChange(() => this.updateValues());

        this.addController(this.params, 'imageSize').onChange(() => this.updateValues());

        this.addController(this.params, 'minMax')
            .name('Elevation range')
            .onChange(() => this.updateValues());

        this.addController(this.params, 'layerInfo').onChange(() => this.updateValues());
    }

    public getOrCreateLabel(obj: TileMesh): CSS2DObject {
        if (!this._labels.has(obj.id)) {
            const label = new CSS2DObject(createTileLabel());
            label.name = 'MapInspector label';
            obj.addEventListener('dispose', () => {
                this.removeLabel(obj.id, label);
            });
            this._root.add(label);
            this._root.updateMatrixWorld(true);
            if (this._root.parent == null) {
                this._root.name = 'TileInfoPanel';
                this.instance.threeObjects.add(this._root);
            }
            this._labels.set(obj.id, label);
        }
        return this._labels.get(obj.id) as CSS2DObject;
    }

    public getInfo(tile: TileMesh): string {
        tmpLines.length = 0;

        if (this.params.nodeInfo) {
            tmpLines.push(
                `Node #${tile.id} LOD=${tile.lod} (${tile.coordinate.x}, ${tile.coordinate.y})`,
            );
        }
        if (this.params.minMax) {
            tmpLines.push(`min: ${tile.minmax.min.toFixed(1)}, max: ${tile.minmax.max.toFixed(1)}`);
        }
        if (this.params.imageSize) {
            const size = tile.getScreenPixelSize(this.instance.view, tmpVec2);
            tmpLines.push(
                `${tile.textureSize.width} * ${tile.textureSize.height} / ${size != null ? Math.max(size.width, size.height) : 'NULL'}`,
            );
        }
        if (this.params.layerInfo) {
            this._map.forEachLayer(layer => {
                const info = layer.getInfo(tile);
                tmpLines.push(
                    `${layer.name ?? layer.id}: ${info.imageCount} img, ${info.state}, ${info.paintCount} paints)`,
                );
            });
        }

        return tmpLines.join('\n');
    }

    private getLabelVisibility(tile: TileMesh, position: Vector3): boolean {
        let result = tile.visible && tile.material.visible;

        if (this.instance.coordinateSystem.isEpsg(4978)) {
            const camPos = this.instance.view.camera.position;
            result = result && Ellipsoid.WGS84.isHorizonVisible(camPos, position);
        }

        return result;
    }

    private getLabelPosition(tile: TileMesh): Vector3 {
        const center = tile.extent.center();
        const elev = this._map.getElevation({ coordinates: center });
        const sample = elev.samples?.sort((a, b) => a.resolution - b.resolution)[0];
        const z = sample?.elevation ?? 0;

        if (this.instance.coordinateSystem.isEpsg(4978)) {
            return Ellipsoid.WGS84.toCartesian(center.latitude, center.longitude, z);
        } else {
            return new Vector3(center.x, center.y, z);
        }
    }

    private removeLabel(id: number, label: CSS2DObject): void {
        label.element.remove();
        label.removeFromParent();
        this._labels.delete(id);
    }

    public updateLabel(tile: TileMesh): void {
        const color = this.params.color;
        const visible = tile.visible && tile.material.visible && this.params.enabled;

        if (!visible) {
            const label = this._labels.get(tile.id);
            if (label) {
                this.removeLabel(tile.id, label);
            }
        } else {
            const label = this.getOrCreateLabel(tile);
            const element = label.element;
            element.innerText = this.getInfo(tile);
            element.style.color = `#${color.getHexString()}`;
            label.position.copy(this.getLabelPosition(tile));
            label.updateMatrixWorld(true);

            const isVisible = this.getLabelVisibility(tile, label.position);
            element.style.opacity = isVisible ? '100%' : '0%';
            label.visible = isVisible;
        }
    }

    public override updateValues(): void {
        this._map.traverseTiles(tile => {
            this.updateLabel(tile);
        });
    }
}

export default TileInfoPanel;
