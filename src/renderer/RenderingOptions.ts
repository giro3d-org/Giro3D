/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * Exposes rendering options for the current Giro3D instance.
 *
 */
class RenderingOptions {
    /**
     * Enables EDL (Eye Dome Lighting) effect for point clouds.
     *
     * @defaultValue false
     */
    public enableEDL: boolean;
    /**
     * The intensity of the EDL effect.
     *
     * @defaultValue 0.7
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public EDLStrength: number;
    /**
     * The radius of the EDL effect.
     *
     * @defaultValue 1.5
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public EDLRadius = 1.5;
    /**
     * Enables inpainting (hole filling) effect for point clouds.
     *
     * @defaultValue false
     */
    public enableInpainting = false;
    /**
     * The number of inpainting steps.
     *
     * @defaultValue 2
     */
    public inpaintingSteps: number;
    /**
     * How much the difference of depth between two pixels contribute to the inpainting weight.
     *
     * @defaultValue 0.5
     */
    public inpaintingDepthContribution: number;
    /**
     * Enables point cloud occlusion effect.
     *
     * @defaultValue false
     */
    public enablePointCloudOcclusion: boolean;
    /**
     * Enables Multisampling Antialiasing (MSAA) on post-processing.
     * @defaultValue true
     */
    public enableMSAA: boolean;

    public constructor() {
        this.enableEDL = false;
        this.EDLStrength = 0.7;
        this.EDLRadius = 1.5;
        this.enableInpainting = false;
        this.inpaintingSteps = 2;
        this.inpaintingDepthContribution = 0.5;
        this.enablePointCloudOcclusion = false;
        this.enableMSAA = true;
    }
}

export default RenderingOptions;
