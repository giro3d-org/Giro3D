#include <giro3d_precision_qualifiers>
#include <giro3d_common>

#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#include <fog_pars_vertex>

uniform sampler2D   elevationTexture;
uniform LayerInfo   elevationLayer;

#if defined(STITCHING)
struct Neighbour {
    vec4            offsetScale;
    float           diffLevel;
};

uniform Neighbour   neighbours[8];
uniform float       segments;
uniform vec2        tileDimensions;
uniform sampler2D   neighbourTextures[8];
#endif

// Outputs
varying vec2        vUv;
varying vec3        wPosition; // World space position
varying vec3        vViewPosition;

const int   NULL = -1;
const int   NO_CORNER_NEIGHBOUR = 0;
const int   ALL_NEIGHBOURS_ARE_SAME_SIZE = 1;
const int   SOME_NEIGHBOURS_ARE_BIGGER = 2;
const float NO_NEIGHBOUR = -99.;
const int   INNER_VERTEX = -1;

const int TOP = 0;
const int TOP_RIGHT = 1;
const int RIGHT = 2;
const int BOTTOM_RIGHT = 3;
const int BOTTOM = 4;
const int BOTTOM_LEFT = 5;
const int LEFT = 6;
const int TOP_LEFT = 7;

#if defined(STITCHING)
struct CornerNeighbour {
    int location;
    float diffLevel;
};

bool isEdge(int location) {
    return mod(float(location), 2.) == 0.;
}

float readNeighbourElevation(vec2 uv, int neighbour, float defaultElevation) {
    // We don't want UV outside the unit square
    vec2 vv = clamp01(uv);

    vec4 offsetScale = neighbours[neighbour].offsetScale;
    vec2 neighbourUv = computeUv(vv, offsetScale.xy, offsetScale.zw);

    // Why can't we simply do neighbourTextures[neighbour] ?
    // It's because of a limitation of GLSL ES : texture arrays cannot be indexed dynamically.
    // They must be indexed by a constant expression (a literal or a constant).
    // See https://stackoverflow.com/a/60110986/2704779
    if (neighbour == TOP)
        return getElevationOrDefault(neighbourTextures[TOP], neighbourUv, defaultElevation);
    if (neighbour == TOP_RIGHT)
        return getElevationOrDefault(neighbourTextures[TOP_RIGHT], neighbourUv, defaultElevation);
    if (neighbour == RIGHT)
        return getElevationOrDefault(neighbourTextures[RIGHT], neighbourUv, defaultElevation);
    if (neighbour == BOTTOM_RIGHT)
        return getElevationOrDefault(neighbourTextures[BOTTOM_RIGHT], neighbourUv, defaultElevation);
    if (neighbour == BOTTOM)
        return getElevationOrDefault(neighbourTextures[BOTTOM], neighbourUv, defaultElevation);
    if (neighbour == BOTTOM_LEFT)
        return getElevationOrDefault(neighbourTextures[BOTTOM_LEFT], neighbourUv, defaultElevation);
    if (neighbour == LEFT)
        return getElevationOrDefault(neighbourTextures[LEFT], neighbourUv, defaultElevation);
    if (neighbour == TOP_LEFT)
        return getElevationOrDefault(neighbourTextures[TOP_LEFT], neighbourUv, defaultElevation);
}

// Returns the seam or corner that this UV belongs to.
// If this UV does not belong to a seam nor a corner, returns INNER_VERTEX
int locateVertex(vec2 uv) {
    const float ONE = 1.;
    const float ZERO = 0.;

    uv = clamp01(uv);

    float x = uv.x;
    float y = uv.y;

    if (y == ONE) {
        if (x == ZERO) {
            return TOP_LEFT;
        } else if (x == ONE) {
            return TOP_RIGHT;
        } else {
            return TOP;
        }
    } else if (y == ZERO) {
        if (x == ZERO) {
            return BOTTOM_LEFT;
        } else if (x == ONE) {
            return BOTTOM_RIGHT;
        } else {
            return BOTTOM;
        }
    } else if (x == ONE) {
        return RIGHT;
    } else if (x == ZERO) {
        return LEFT;
    } else {
        return INNER_VERTEX;
    }
}

/**
 * Computes the offsets of vertex position and UV coordinate to apply to this vertex
 * in order to fuse it with a neighbouring vertex.
 */
bool computeXYStitchingOffsets(
    // the UV of the vertex
    vec2 uv,
    // the location of the vertex (seam, corner, or inner)
    int location,
    // the resulting offset to apply to the vertex local space position
    out vec3 vertexOffset,
    // the resulting offset to apply to the vertex UV
    out vec2 uvOffset) {

    vec3 factor;
    float axis;

    const vec2 NO_UV_OFFSET = vec2(0, 0);
    const vec3 NO_POS_OFFSET = vec3(0, 0, 0);

    if (location == RIGHT || location == LEFT) {
        factor = vec3(0, 1, 0);
        axis = uv.y;
    } else if (location == TOP || location == BOTTOM) {
        factor = vec3(1, 0, 0);
        axis = uv.x;
    } else {
        // we only move vertices that do belong to seams and nothing else.
        vertexOffset = NO_POS_OFFSET;
        uvOffset = NO_UV_OFFSET;
        return false;
    }

    float diffLevel = neighbours[location].diffLevel;
    if (diffLevel == NO_NEIGHBOUR) {
        vertexOffset = NO_POS_OFFSET;
        uvOffset = NO_UV_OFFSET;
        return false;
    }

    // XY-stitching only concerns tiles smaller than their neighbour.
    if (diffLevel < 0.) {
        float neighbourFactor = pow(2.0, abs(diffLevel));
        float modulo = neighbourFactor / segments;
        float offset = fract(axis / modulo) * modulo;
        uvOffset = offset * factor.xy;
        vertexOffset = offset * factor * vec3(tileDimensions, 0);
        return true;
    } else {
        vertexOffset = NO_POS_OFFSET;
        uvOffset = NO_UV_OFFSET;
        return false;
    }
}

CornerNeighbour getNeighbour(int location) {
    float diffLevel = neighbours[location].diffLevel;
    CornerNeighbour result;

    if (diffLevel != NO_NEIGHBOUR) {
        result.location = location;
        result.diffLevel = diffLevel;
    } else {
        result.location = NULL;
        result.diffLevel = NO_NEIGHBOUR;
    }

    return result;
}

/**
 * Returns the locations of the three possible neighbours of this corner location.
 * If a neighbour is not present, its value is NULL.
 * If a neighbour is bigger than us, short-circuit and return only this neighbour.
 * Returns true if at least one corner neighbour exists.
 */
ivec4 getCornerNeighbours(int location) {
    int result = ALL_NEIGHBOURS_ARE_SAME_SIZE;

    int n0 = NULL;
    int n1 = NULL;
    int n2 = NULL;

    CornerNeighbour cn0;
    CornerNeighbour cn1;
    CornerNeighbour cn2;

    float biggerDiffLevel = 0.;

    bool atLeastOne = false;

    float floc = float(location);

    // one of the neighbour is the location itself of course
    cn0 = getNeighbour(location);
    if (cn0.diffLevel != NO_NEIGHBOUR) {
        biggerDiffLevel = min(biggerDiffLevel, cn0.diffLevel);
        atLeastOne = true;
    }

    int next = int(mod(floc + 1., 8.));
    cn1 = getNeighbour(next);
    if (cn1.diffLevel != NO_NEIGHBOUR) {
        biggerDiffLevel = min(biggerDiffLevel, cn1.diffLevel);
        atLeastOne = true;
    }

    int prev = int(mod(floc - 1., 8.));
    cn2 = getNeighbour(prev);
    if (cn2.diffLevel != NO_NEIGHBOUR) {
        biggerDiffLevel = min(biggerDiffLevel, cn2.diffLevel);
        atLeastOne = true;
    }

    if (atLeastOne) {
        // Eliminate corners that are smaller than the others
        if (cn0.location != NULL && cn0.diffLevel != biggerDiffLevel) {
            cn0.location = NULL;
            result = SOME_NEIGHBOURS_ARE_BIGGER;
        }
        if (cn1.location != NULL && cn1.diffLevel != biggerDiffLevel) {
            cn1.location = NULL;
            result = SOME_NEIGHBOURS_ARE_BIGGER;
        }
        if (cn2.location != NULL && cn2.diffLevel != biggerDiffLevel) {
            cn2.location = NULL;
            result = SOME_NEIGHBOURS_ARE_BIGGER;
        }

        n0 = cn0.location;
        n1 = cn1.location;
        n2 = cn2.location;

        return ivec4(result, n0, n1, n2);
    }

    return ivec4(NO_CORNER_NEIGHBOUR, NULL, NULL, NULL);
}

float computeZStitchedElevation(vec2 uv, int location, float currentElevation) {
    // First case : the vertex is on an edge
    if (isEdge(location)) {
        float diffLevel = neighbours[location].diffLevel;

        // We don't have any neighbour at this location
        if (diffLevel == NO_NEIGHBOUR) {
            return currentElevation;
        }

        // If our neighbour has the same level (hence size), we average the two elevations
        // This neighbour will do the same in its own vertex shader with our elevation, and
        // the two vertices will have the same height.
        float neighbourElevation = readNeighbourElevation(uv, location, currentElevation);
        if (diffLevel == 0.) {
            return mix(currentElevation, neighbourElevation, 0.5);
        } else if (diffLevel < 0.) {
            // If our neighbour is bigger than us, we don't average. Instead, we take its elevation.
            // The reason for this behaviour is that it's not possible for the bigger neighbour to
            // average with our elevation, as the bigger neighbour can have more than one neighbour
            // for the same edge, making the computation really impractical.
            return neighbourElevation;
        }
    } else {
        // Corner case (pun intended). This case is more complicated as we can have up to 3 neighbours,
        // and the rule differ whether one neighbour is bigger than us.
        // If all the neighbours of this corner have the same depth, we average, otherwise we take the
        // elevation of the biggest neighbour.

        // First, we need to collect the theoretical neighbours, then eliminate the absent ones.
        ivec4 corners = getCornerNeighbours(location);

        int cornerSituation = corners[0];

        // First, check that we have at least one corner neighbour.
        if (cornerSituation != NO_CORNER_NEIGHBOUR) {
            int n0, n1, n2;

            n0 = corners[1];
            n1 = corners[2];
            n2 = corners[3];

            float sum;
            float weight;

            if (cornerSituation == ALL_NEIGHBOURS_ARE_SAME_SIZE) {
                // Now compute the weighted average between existing (same level) neighbours.
                sum = currentElevation;
                weight = 1.;
            } else {
                // If the neighbour(s) are bigger, we don't average with our own elevation, but
                // we only consider the neighbours' elevation.
                sum = 0.;
                weight = 0.;
            }

            if (n0 != NULL) {
                sum += readNeighbourElevation(uv, n0, currentElevation);
                weight += 1.;
            }
            if (n1 != NULL) {
                sum += readNeighbourElevation(uv, n1, currentElevation);
                weight += 1.;
            }
            if (n2 != NULL) {
                sum += readNeighbourElevation(uv, n2, currentElevation);
                weight += 1.;
            }

            return sum / weight;
        }
    }

    return currentElevation;
}

#endif

void main() {
    vUv = uv;
    #include <begin_vertex>

    float elevation = 0.0;

#if defined(TERRAIN_DEFORMATION)
#if defined(ELEVATION_LAYER)
    if(elevationLayer.offsetScale.z > 0.) {
        vec2 vVv = computeUv(vUv, elevationLayer.offsetScale.xy, elevationLayer.offsetScale.zw);

        elevation = getElevation(elevationTexture, vVv);

#if defined(STITCHING)
        /*
            Stitching aims to eliminate visible cracks between neighbouring tiles, that are caused
            by slight discrepancies in elevation and a different level of detail (LOD).

            This process contains 2 steps : XY-stitching and Z-stitching.

            XY-stitching
            ============

            XY-stitching works on the horizontal plane and is used to weld seams for neighbour tiles
            that have a different levels.

            The smallest tile (with the highest level) has a higher vertex density along the seam.
            Meaning that some vertices will not have an equivalent vertex in the neighbour, leading
            to visible cracks.

            In this figure, XY-stitching moves vertex A along the seam to the position of B.
            A and B have now exactly the same position in space, and the crack is removed.

            +------B------+------+      +------A+B----+------+
            |      |             |      |    / |             |
            |      |             |      | /    |             |
            +------A             +  =>  +      |             |
            |      |             |      |      |             |
            |      |             |      |      |             |
            +------+------+------+      +------+------+------+

            Note : XY-stitching only moves intermediate vertices of the seams, not corner vertices.

            Z-stitching
            ============

            Z-stitching is used to reconcile the variations in elevation (on the Z-axis) between the
            neighbouring seams, due to the fact that elevation pixels may have slightly different
            values on each side of the seam.
        */

        // Locate the vertex (is it on a seam, on a corner, or an inner vertex ?)
        int location = locateVertex(uv);

        // Don't perform stitching on vertices that are not on borders
        if (location != INNER_VERTEX) {
            vec3 vertexOffset;
            vec2 uvOffset;

            // Is there XY-stiching ?
            if (computeXYStitchingOffsets(
                    vUv,
                    location,
                    vertexOffset,
                    uvOffset)) {

                // move the UV and the vertex to perform XY-stitching
                vUv -= uvOffset;
                transformed -= vertexOffset;

                // sanitize the UV to fight off potential rounding errors (we don't want the UV to
                // be outside the unit square)
                vUv = clamp01(vUv);

                // The vertex has moved, maybe now it location has changed (from seam to corner)
                location = locateVertex(vUv);
            }

            // Get the elevation of our vertex in our texture
            vec2 elevUv = computeUv(vUv, elevationLayer.offsetScale.xy, elevationLayer.offsetScale.zw);
            float currentElevation = getElevation(elevationTexture, elevUv);

            // Then apply Z-stitching
            elevation = computeZStitchedElevation(vUv, location, currentElevation);
        }
#endif // STITCHING
    }
#endif // ELEVATION_LAYER
#endif // TERRAIN_DEFORMATION

    transformed.z = elevation;

    #include <project_vertex>
    #include <fog_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>

    wPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vViewPosition = -mvPosition.xyz;
}
