/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * Defines a heading, pitch and roll in degrees.
 */
export interface HeadingPitchRollLike {
    /**
     * The heading (or azimuth), in degrees. Zero is north, 90 is east, and so on.
     */
    heading?: number;
    /**
     * The pitch, in degrees. Represents the angle from the horizontal plane. Positive values look above the horizon, and negative values look below the horizon.
     */
    pitch?: number;
    /**
     * The roll, in degrees. Represents the rotation around the forward axis. Positives values tilt on the right.
     */
    roll?: number;
}

/**
 * Defines a heading, pitch and roll in degrees.
 */
export default class HeadingPitchRoll implements HeadingPitchRollLike {
    /**
     * The heading (or azimuth), in degrees. Zero is north, 90 is east, and so on.
     * @defaultValue 0
     */
    public heading: number;
    /**
     * The pitch, in degrees. Represents the angle from the horizontal plane. Positive values look above the horizon, and negative values look below the horizon.
     * @defaultValue 0
     */
    public pitch: number;
    /**
     * The roll, in degrees. Represents the rotation around the forward axis. Positives values tilt on the right.
     * @defaultValue 0
     */
    public roll: number;

    /**
     * @param heading - The heading (or azimuth), in degrees. Zero is north, 90 is east, and so on.
     * @param pitch - The pitch, in degrees. Represents the angle from the horizontal plane. Positive values look above the horizon, and negative values look below the horizon.
     * @param roll - The roll, in degrees. Represents the rotation around the forward axis. Positives values tilt on the right.
     */
    public constructor(heading?: number, pitch?: number, roll?: number) {
        this.heading = heading ?? 0;
        this.pitch = pitch ?? 0;
        this.roll = roll ?? 0;
    }
}
