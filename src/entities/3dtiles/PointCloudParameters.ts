import type { Color } from 'three';
import type ColorimetryOptions from '../../core/ColorimetryOptions';
import type ColorMap from '../../core/ColorMap';
import type { Classification, Mode } from '../../renderer/PointCloudMaterial';

type PointCloudParameters = {
    colorimetry: ColorimetryOptions;
    pointSize: number;
    pointCloudMode: Mode;
    pointCloudColorMap: ColorMap;
    classifications: Classification[];
    overlayColor: Color | null;
};

export default PointCloudParameters;
