import type ColorMap from '../../core/ColorMap';
import type { Classification, Mode } from '../../renderer/PointCloudMaterial';

type PointCloudParameters = {
    pointSize: number;
    pointCloudMode: Mode;
    pointCloudColorMap: ColorMap;
    classifications: Classification[];
};

export default PointCloudParameters;
