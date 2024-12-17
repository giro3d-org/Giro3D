import type { AttributeName } from './attributes';
import type BoundingBox from './BoundingBox';

export type Metadata = {
    version: string;
    octreeDir: string;
    points?: number;
    projection?: string;
    boundingBox: BoundingBox;
    tightBoundingBox?: BoundingBox;
    pointAttributes: AttributeName[] | 'LAZ';
    spacing: number;
    scale: number;
    hierarchyStepSize: number;
};
