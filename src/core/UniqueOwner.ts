/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * Trait for objects that have a unique owner.
 */
interface UniqueOwner<T, Owner = unknown> {
    owner: Owner;
    payload: T;
}

/**
 * Creates an {@link UniqueOwner} object with the specified owner and payload.
 * @param object - The owned payload.
 * @param owner - The owner.
 */
export function intoUniqueOwner<T, Owner = unknown>(
    object: T,
    owner: Owner,
): UniqueOwner<T, Owner> {
    return {
        payload: object,
        owner,
    };
}

export default UniqueOwner;
