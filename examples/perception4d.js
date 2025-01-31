import {
    AxesHelper,
    Euler,
    Group,
    MathUtils,
    Matrix3,
    Matrix4,
    Object3D,
    PerspectiveCamera,
    Spherical,
    Vector3,
} from 'three';

import FirstPersonControls from '@giro3d/giro3d/controls/FirstPersonControls.js';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import PointCloud from '@giro3d/giro3d/entities/PointCloud.js';
import Shape, { isShapePickResult } from '@giro3d/giro3d/entities/Shape.js';
import SphericalPanorama from '@giro3d/giro3d/entities/SphericalPanorama.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import COPCSource from '@giro3d/giro3d/sources/COPCSource.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';
import Fetcher from '@giro3d/giro3d/utils/Fetcher.js';

import { placeCameraOnTop } from './widgets/placeCameraOnTop.js';
import StatusBar from './widgets/StatusBar.js';
import Ellipsoid from '@giro3d/giro3d/core/geographic/Ellipsoid.js';
import EllipsoidHelper from '@giro3d/giro3d/helpers/EllipsoidHelper.js';
import Globe from '@giro3d/giro3d/entities/Globe.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import { XYZ } from 'ol/source.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import StaticImageSource from '@giro3d/giro3d/sources/StaticImageSource.js';

let SRID = 'EPSG:32617';
// const SRID = 'ESRI:103514';
// const SRID = 'EPSG:4978';

Instance.registerCRS('EPSG:32617', '+proj=utm +zone=17 +datum=WGS84 +units=m +no_defs +type=crs');
// Instance.registerCRS(
//     'ESRI:103514',
//     '+proj=lcc +lat_0=40.1666666666667 +lon_0=-77.75 +lat_1=40.8833333333333 +lat_2=41.95 +x_0=600000 +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs',
// );
Instance.registerCRS('EPSG:4978', '+proj=geocent +datum=WGS84 +units=m +no_defs +type=crs');

const instance = new Instance({ target: 'view', crs: SRID });

const rootUrl = 'http://localhost:14000/private/Perception4D/out/4';

const copc = new COPCSource({
    url: `${rootUrl}/dataset.copc.laz`,
});
const pointCloud = new PointCloud({ source: copc });

const firstPersonControls = new FirstPersonControls(instance, { focusOnClick: true });

/** @type {Map<number, SphericalPanorama>} */
const panoramas = new Map();

let panoIndex = 0;

/**
 * @type {Array<{ url: URL; position: Vector3; heading: number; pitch: number; roll: number }>}
 */
const images = [];

function setCameraPosition(index) {
    /** @type {PerspectiveCamera} */
    const camera = instance.view.camera;

    camera.position.copy(images[index].position);
    const next = images[index + 1];

    if (next) {
        camera.lookAt(next.position);
    }

    if (instance.view.controls) {
        instance.view.controls.enabled = false;
    }
    camera.fov = 80;
    camera.updateMatrixWorld(true);
    instance.view.setControls(null);
    firstPersonControls.reset();

    instance.notifyChange(camera);
}

/**
 * @param {number} index
 */
function loadPanorama(index) {
    const { url, position, heading, pitch, roll } = images[index];

    const urlString = url.toString();

    const group = new Group();

    const panorama = new SphericalPanorama({ radius: 5 });

    panorama.showTileOutlines = true;

    panorama.renderOrder = 9999;
    panorama.opacity = 0.5;
    panorama.graticule.enabled = true;
    panorama.graticule.xStep = 10;
    panorama.graticule.yStep = 10;
    panorama.graticule.thickness = 0.3;

    panoramas.set(index, panorama);
    // panorama.terrain.segments = 32;
    const fragments = url.pathname.split('/');
    panorama.name = fragments[fragments.length - 1].replace('.cog.tif', '');

    return instance.add(panorama).then(() => {
        group.name = panorama.name;

        instance.add(group);
        group.add(panorama.object3d);

        const worldAxes = new AxesHelper(8);
        const localAxes = new AxesHelper(7);
        panorama.addLayer(
            new ColorLayer({
                source: new GeoTIFFSource({
                    url: urlString,
                    crs: 'EPSG:4326',
                }),
            }),
        );
        panorama.renderOrder = -1;
        group.add(localAxes);
        worldAxes.visible = false;

        // vec3 u = normal;
        // vec3 e = normalize(cross(Z, normal));
        // vec3 n = normalize(cross(u, e));

        // mat4 enu = transpose(mat4(
        //     e.x, e.y, e.z, 0.0,
        //     n.x, n.y, n.z, 0.0,
        //     u.x, u.y, u.z, 0.0,
        //     0.0, 0.0, 0.0, 1.0
        // ));

        if (SRID === 'EPSG:4978') {
            const u = Ellipsoid.WGS84.getNormalFromCartesian(position);
            const e = new Vector3().crossVectors(new Vector3(0, 0, 1), u).normalize();
            const n = new Vector3().crossVectors(u, e).normalize();
            const p = position;
            // prettier-ignore
            const enu = new Matrix4()
            .set(
                e.x, e.y, e.z, 0.0,
                n.x, n.y, n.z, 0.0,
                u.x, u.y, u.z, 0.0,
                p.x, p.y, p.z, 1.0)
                .transpose();
            panorama.object3d.applyMatrix4(enu);

            panorama.object3d.updateMatrixWorld(true);

            panorama.object3d.rotateOnWorldAxis(u, MathUtils.degToRad(heading));
            panorama.object3d.rotateOnWorldAxis(n, MathUtils.degToRad(roll));
            panorama.object3d.rotateOnWorldAxis(e, MathUtils.degToRad(pitch));
        } else {
            group.position.copy(position);
            worldAxes.position.copy(position);
            instance.scene.add(worldAxes);
            worldAxes.updateMatrixWorld(true);

            const h = MathUtils.degToRad(heading);
            const p = MathUtils.degToRad(pitch);
            const r = MathUtils.degToRad(roll);

            // // prettier-ignore
            // const Z = new Matrix3(
            //     Math.cos(-h), -Math.sin(-h), 0,
            //     Math.sin(-h), Math.cos(-h), 0,
            //     0,  0, 1
            // );

            // // prettier-ignore
            // const X = new Matrix3(
            //     1, 0, 0,
            //     0, Math.cos(p), -Math.sin(p),
            //     0, Math.sin(p), Math.cos(p)
            // );

            // // prettier-ignore
            // const Y = new Matrix3(
            //     Math.cos(r), 0, Math.sin(r),
            //     0, 1, 0,
            //     -Math.sin(r), 0, Math.cos(r),
            // );

            // const m = new Matrix3().multiplyMatrices(new Matrix3().multiplyMatrices(Z, X), Y);
            // panorama.object3d.setRotationFromMatrix(new Matrix4().setFromMatrix3(m));

            const matrix = new Matrix4().makeRotationFromEuler(new Euler(p, r, -h, 'ZXY'));
            panorama.object3d.setRotationFromMatrix(matrix);

            group.updateMatrixWorld(true);
        }

        return panorama;
    });
}

function getForward(object) {
    object.updateWorldMatrix(true, false);

    const e = object.matrixWorld.elements;

    return new Vector3().set(e[4], e[5], e[6]).normalize();
}

/**
 * @param {SphericalPanorama} panorama
 */
function setExactPosition(panorama) {
    /** @type {PerspectiveCamera} */
    const camera = instance.view.camera;

    camera.position.copy(panorama.object3d.parent.position);
    // const next = points[index + 1];

    // if (next) {
    //     camera.lookAt(next);
    // }

    const dir = getForward(panorama.object3d);
    camera.lookAt(camera.position.clone().add(dir));

    if (instance.view.controls) {
        instance.view.controls.enabled = false;
    }
    camera.fov = 80;
    camera.updateMatrixWorld(true);
    instance.view.setControls(null);
    firstPersonControls.reset();

    instance.notifyChange(camera);
}

async function setPOV(index) {
    const current = panoramas.get(index);
    if (current) {
        current.visible = true;
    } else {
        await loadPanorama(index);
    }

    // setCameraPosition(index);
    setExactPosition(panoramas.get(index));
}

function addGlobe() {
    const globe = new Globe({});
    instance.add(globe);

    const key =
        'pk.eyJ1IjoidG11Z3VldCIsImEiOiJjbGJ4dTNkOW0wYWx4M25ybWZ5YnpicHV6In0.KhDJ7W5N3d1z3ArrsDjX_A';
    globe.addLayer(
        new ColorLayer({
            resolutionFactor: 4,
            extent: globe.extent,
            source: new StaticImageSource({
                source: 'http://localhost:14000/images/photosphere.jpg',
            }),
            // source: new TiledImageSource({
            //     source: new XYZ({
            //         url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${key}`,
            //     }),
            // }),
        }),
    );

    // Adds a XYZ elevation layer with MapBox terrain RGB tileset
    const elevationLayer = new ElevationLayer({
        name: 'xyz_elevation',
        extent: globe.extent,
        source: new TiledImageSource({
            format: new MapboxTerrainFormat(),
            source: new XYZ({
                url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${key}`,
            }),
        }),
    });
    globe.addLayer(elevationLayer);
}

let index = 0;

async function loadGeoJSON() {
    const { features } = await Fetcher.json(`${rootUrl}/features.geojson`);

    for (const feature of features) {
        const [lon, lat, alt] = feature.geometry.coordinates;
        /** @type {Vector3} */
        let coord;
        if (SRID === 'EPSG:4978') {
            coord = Ellipsoid.WGS84.toCartesian(lat, lon, alt);
        } else {
            coord = new Coordinates('EPSG:4326', lon, lat, alt)
                .as(instance.referenceCrs)
                .toVector3();
        }

        images.push({
            position: coord,
            url: new URL(feature.properties.url, `${rootUrl}/`),
            heading: feature.properties.heading,
            pitch: feature.properties.pitch,
            roll: feature.properties.roll,
        });
    }
}

async function run() {
    instance.renderingOptions.enableEDL = true;

    await instance.add(pointCloud);

    if (SRID === 'EPSG:4978') {
        const helper = new EllipsoidHelper({
            ellipsoid: Ellipsoid.WGS84,
            parallels: 179,
            meridians: 360,
        });
        instance.add(helper);
        instance.view.camera.up = Ellipsoid.WGS84.getNormal(38, -83);
    }

    pointCloud.setActiveAttribute('Z');

    pointCloud.colorMap.colors = makeColorRamp('jet');
    const bbox = pointCloud.getBoundingBox();
    pointCloud.colorMap.min = bbox.min.z;
    pointCloud.colorMap.max = bbox.max.z;

    placeCameraOnTop(bbox, instance);

    await loadGeoJSON();

    // preload
    // for (let i = 0; i < urls.length; i++) {
    //     loadPanorama(index).then(p => panoramas.set(i, p));
    // }

    const path = new Shape();
    const points = images.map(img => img.position);
    path.setPoints(points);
    path.showLine = true;
    path.lineWidth = 2;
    path.showVertices = true;

    path.visible = false;

    instance.add(path);

    Inspector.attach('inspector', instance);
    StatusBar.bind(instance);

    let once = false;
    const pickShapeIndex = e => {
        if (once) {
            return;
        }
        const picked = instance.pickObjectsAt(e, { where: [path], sortByDistance: true });
        if (picked.length > 0) {
            const pick = picked[0];
            if (isShapePickResult(pick)) {
                const index = pick.pickedVertexIndex;
                panoIndex = index;
                once = true;
                setPOV(index);
            }
        }
    };

    instance.domElement.addEventListener('click', pickShapeIndex);

    panoIndex = 0;
    setPOV(panoIndex);
}

run();

let heading = 0;
let pitch = 0;
let offsetZ = 0;

instance.domElement.addEventListener('keypress', e => {
    const currentPanorama = panoramas.get(panoIndex);

    /** @type {Object3D} */
    const obj = currentPanorama?.object3d;

    const printOffsets = () => {
        const signed = x => `${Math.sign(x) > 0 ? '+' : ''}${x}`;
        console.log(`heading: ${signed(heading)}°, Z: ${signed(offsetZ)}`);
    };

    if (currentPanorama) {
        const deg = 0.5;
        const step = MathUtils.degToRad(deg);

        if (e.key === 't') {
            pointCloud.visible = !pointCloud.visible;
            currentPanorama.visible = !pointCloud.visible;
        }

        if (e.key === 'd') {
            obj.rotateZ(step);
            heading += deg;
        } else if (e.key === 'q') {
            obj.rotateZ(-step);
            heading -= deg;
        }

        if (e.key === 'z') {
            obj.rotateY(step);
            pitch += deg;
        } else if (e.key === 's') {
            obj.rotateY(-step);
            pitch -= deg;
        }

        obj.updateMatrixWorld(true);
        instance.notifyChange();
    }

    const Z_INCREMENT = 0.1;
    if (e.key === 'u') {
        if (currentPanorama) {
            offsetZ += Z_INCREMENT;
            obj.translateZ(Z_INCREMENT);
            instance.view.camera.position.copy(obj.position);
            instance.view.camera.updateMatrixWorld(true);
            obj.updateMatrixWorld(true);
        }
    }
    if (e.key === 'j') {
        if (currentPanorama) {
            offsetZ -= Z_INCREMENT;
            obj.translateZ(-Z_INCREMENT);
            instance.view.camera.position.copy(obj.position);
            instance.view.camera.updateMatrixWorld(true);
            obj.updateMatrixWorld(true);
        }
    }

    const reset = () => {
        if (currentPanorama) {
            currentPanorama.visible = false;
        }
        heading = 0;
        offsetZ = 0;
        pitch = 0;
    };

    if (e.key === 'e' && panoIndex < images.length - 1) {
        reset();
        panoIndex++;
        setPOV(panoIndex);
    }
    if (e.key === 'a' && panoIndex > 0) {
        reset();
        panoIndex--;
        setPOV(panoIndex);
    }

    printOffsets();
});
