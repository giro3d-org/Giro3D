/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import { tile } from 'ol/loadingstrategy.js';
import VectorSource from 'ol/source/Vector.js';
import { createXYZ } from 'ol/tilegrid.js';
import { MathUtils, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import FeatureCollection from '@giro3d/giro3d/entities/FeatureCollection.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

import { bindColorPicker } from './widgets/bindColorPicker.js';
import { bindDropDown } from './widgets/bindDropDown.js';
import { bindSlider } from './widgets/bindSlider.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import StatusBar from './widgets/StatusBar.js';

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.epsg3857,
    backgroundColor: null,
});

const extent = new Extent(
    CoordinateSystem.epsg3857,
    -20037508.342789244,
    20037508.342789244,
    -20037508.342789244,
    20037508.342789244,
);

const colors = {
    'North America': '#b5a98f',
    'South America': '#adc78b',
    Asia: '#d4d496',
    Africa: '#db95a5',
    Oceania: '#c49856',
    Europe: '#ac96d4',
};

let colorMode = 'continent';
let lineWidth = 1;
let fillOpacity = 1;
let imageSize = 32;
let strokeOpacity = 1;

const getContinentColor = feature => {
    const properties = feature.getProperties();
    const continent = properties['continent'];

    return colors[continent];
};

const populationColorMap = makeColorRamp('bluered');

const getPopulationColor = feature => {
    const properties = feature.getProperties();
    const population = properties['pop_est'];

    const colorIndex = MathUtils.clamp(Math.log(population * 0.0001) * 20, 0, 255);

    return populationColorMap[Math.round(colorIndex)];
};

const gdpColorRamp = makeColorRamp('hot', false, true);

const getGdpColor = feature => {
    const properties = feature.getProperties();
    const gdp = properties['gdp_md'];

    const colorIndex = MathUtils.clamp(Math.log(gdp * 0.0001) * 30, 0, 255);

    return gdpColorRamp[Math.round(colorIndex)];
};

const countryStyle = feature => {
    const properties = feature.getProperties();

    let fillColor;
    let activeColor;

    switch (colorMode) {
        case 'continent':
            fillColor = getContinentColor(feature);
            activeColor = 'yellow';
            break;
        case 'population':
            fillColor = getPopulationColor(feature);
            activeColor = 'yellow';
            break;
        case 'gdp':
            fillColor = getGdpColor(feature);
            activeColor = 'cyan';
            break;
    }

    const hovered = properties.hovered ?? false;
    const clicked = properties.clicked ?? false;

    const fill = clicked ? activeColor : fillColor;

    return {
        fill: {
            color: fill,
            depthTest: false,
            renderOrder: 1,
            opacity: fillOpacity,
        },
        stroke: {
            opacity: strokeOpacity,
            color: clicked || hovered ? activeColor : 'black',
            renderOrder: 2, // To ensure lines are displayed on top of surfaces
            lineWidth: clicked ? lineWidth * 2 : lineWidth,
            depthTest: false,
        },
    };
};

const countries = new FeatureCollection({
    name: 'countries',
    source: new VectorSource({
        format: new GeoJSON(),
        url: 'https://3d.oslandia.com/giro3d/vectors/countries.geojson',
        strategy: tile(createXYZ({ tileSize: 512 })),
    }),
    extent,
    style: countryStyle,
    minLevel: 0,
    maxLevel: 0,
});

instance.add(countries);

const capitalStyle = feature => {
    const image = 'https://3d.oslandia.com/giro3d/images/capital.webp';
    const clicked = feature.get('clicked');
    const hovered = feature.get('hovered');

    return {
        point: {
            color: clicked ? 'yellow' : hovered ? 'orange' : 'white',
            pointSize: clicked ? imageSize * 1.5 : imageSize,
            image,
            renderOrder: clicked ? 4 : 3,
        },
    };
};

const capitals = new FeatureCollection({
    name: 'capitals',
    source: new VectorSource({
        format: new GeoJSON(),
        url: 'https://3d.oslandia.com/giro3d/vectors/capitals.geojson',
        strategy: tile(createXYZ({ tileSize: 512 })),
    }),
    extent,
    style: capitalStyle,
    minLevel: 0,
    maxLevel: 0,
});

instance.add(capitals);

instance.view.camera.position.set(0, 5500000, 50000000);
const lookAt = new Vector3(0, 5500000 + 1, 0);
instance.view.camera.lookAt(lookAt);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.4;
controls.target.copy(lookAt);
controls.saveState();
instance.view.setControls(controls);

// information on click
const resultTable = document.getElementById('results');

function truncate(value, length) {
    if (value == null) {
        return null;
    }

    const text = `${value}`;

    if (text.length < length) {
        return text;
    }

    return text.substring(0, length) + '…';
}

const filteredAttributes = ['country', 'city', 'continent', 'name', 'gdp_md', 'pop_est'];

const gdpFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
});

const popFormatter = new Intl.NumberFormat(undefined, {
    style: 'decimal',
});

function formatValue(attribute, value) {
    switch (attribute) {
        case 'gdp_md':
            return gdpFormatter.format(value);
        case 'pop_est':
            return popFormatter.format(value);
        default:
            return truncate(value, 18);
    }
}

function fillTable(objects) {
    resultTable.innerHTML = '';
    document.getElementById('attributes').style.display = objects.length > 0 ? 'block' : 'none';

    for (const obj of objects) {
        if (!obj.userData.feature) {
            continue;
        }
        const p = obj.userData.feature.getProperties();

        const entries = [];
        for (const [key, value] of Object.entries(p)) {
            if (filteredAttributes.includes(key)) {
                const entry = `<tr>
                <td title="${key}"><code>${truncate(key, 12)}</code></td>
                <td title="${value}">${formatValue(key, value) ?? '<code>null</code>'}</td>
                </tr>`;
                entries.push(entry);
            }
        }

        resultTable.innerHTML += `
        <table class="table table-sm">
            <thead>
                <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Value</th>
                </tr>
            </thead>
            <tbody>
                ${entries.join('')}
            </tbody>
        </table>
    `;
    }
}

const previousHovered = [];
const previousClicked = [];
const objectsToUpdate = [];

function pick(e, click) {
    const pickedObjects = instance.pickObjectsAt(e, {
        where: [capitals, countries],
    });

    if (click) {
        previousClicked.forEach(obj => obj.userData.feature.set('clicked', false));
    } else {
        previousHovered.forEach(obj => obj.userData.feature.set('hovered', false));
    }

    const property = click ? 'clicked' : 'hovered';

    objectsToUpdate.length = 0;

    if (pickedObjects.length > 0) {
        const picked = pickedObjects[0];
        const obj = picked.object;
        const { feature } = obj.userData;

        feature.set(property, true);

        objectsToUpdate.push(obj);
    }

    if (click) {
        fillTable(objectsToUpdate);
    }

    // To avoid updating all the objects and lose a lot of performance,
    // we only update the objects that have changed.
    const updatedObjects = [...previousHovered, ...previousClicked, ...objectsToUpdate];
    if (click) {
        previousClicked.splice(0, previousClicked.length, ...objectsToUpdate);
    } else {
        previousHovered.splice(0, previousHovered.length, ...objectsToUpdate);
    }

    if (updatedObjects.length > 0) {
        countries.updateStyles(updatedObjects);
        capitals.updateStyles(updatedObjects);
    }
}

const hover = e => pick(e, false);
const click = e => pick(e, true);

instance.domElement.addEventListener('mousemove', hover);
instance.domElement.addEventListener('click', click);

for (const continent of Object.keys(colors)) {
    let timeout;
    const [setColor] = bindColorPicker(continent, c => {
        colors[continent] = c;
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => countries.updateStyles(), 16);
    });
    setColor(colors[continent]);
}

const [setLineWidth] = bindSlider('line-width', v => {
    lineWidth = v;
    countries.updateStyles();
});

setLineWidth(lineWidth);

const [setStrokeOpacity] = bindSlider('stroke-opacity', v => {
    strokeOpacity = v;
    countries.updateStyles();
});

setStrokeOpacity(strokeOpacity);

const [setFillOpacity] = bindSlider('fill-opacity', v => {
    fillOpacity = v;
    countries.updateStyles();
});

setFillOpacity(fillOpacity);

const [setImageSize] = bindSlider('image-size', v => {
    imageSize = v;
    capitals.updateStyles();
});

setImageSize(imageSize);

bindDropDown('color-mode', mode => {
    colorMode = mode;
    countries.updateStyles();
    document.getElementById('colors').style.display = colorMode === 'continent' ? 'block' : 'none';
});

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
