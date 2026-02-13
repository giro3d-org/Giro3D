/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { ShaderChunk } from 'three';

// We use non camel-case file names to be as consistent as possible with three.js naming scheme
import giro3d_colormap_pars_fragment from './giro3d_colormap_pars_fragment.glsl';
import giro3d_common from './giro3d_common.glsl';
import giro3d_compose_layers_pars_fragment from './giro3d_compose_layers_pars_fragment.glsl';
import giro3d_contour_line_fragment from './giro3d_contour_line_fragment.glsl';
import giro3d_contour_line_pars_fragment from './giro3d_contour_line_pars_fragment.glsl';
import giro3d_fragment_shader_header from './giro3d_fragment_shader_header.glsl';
import giro3d_graticule_fragment from './giro3d_graticule_fragment.glsl';
import giro3d_graticule_pars_fragment from './giro3d_graticule_pars_fragment.glsl';
import giro3d_hillshading_pars_fragment from './giro3d_hillshading_pars_fragment.glsl';
import giro3d_intersecting_volume_pars from './giro3d_intersecting_volume_pars.glsl';
import giro3d_outline_fragment from './giro3d_outline_fragment.glsl';
import giro3d_outline_pars_fragment from './giro3d_outline_pars_fragment.glsl';
import giro3d_precision_qualifiers from './giro3d_precision_qualifiers.glsl';
import giro3d_terrain_pars_vertex from './giro3d_terrain_pars_vertex.glsl';
import giro3d_terrain_vertex from './giro3d_terrain_vertex.glsl';

type ShaderChunk = typeof ShaderChunk;

interface Giro3DShaderChunk extends ShaderChunk {
    giro3d_common: string;
    giro3d_outline_pars_fragment: string;
    giro3d_outline_fragment: string;
    giro3d_precision_qualifiers: string;
    giro3d_compose_layers_pars_fragment: string;
    giro3d_colormap_pars_fragment: string;
    giro3d_contour_line_pars_fragment: string;
    giro3d_contour_line_fragment: string;
    giro3d_fragment_shader_header: string;
    giro3d_graticule_fragment: string;
    giro3d_graticule_pars_fragment: string;
    giro3d_hillshading_pars_fragment: string;
    giro3d_hillshading_begin_fragment: string;
    giro3d_intersecting_volume_pars: string;
    giro3d_terrain_pars_vertex: string;
    giro3d_terrain_vertex: string;
}

export default function registerChunks(): void {
    const Giro3dShaderChunk = ShaderChunk as Giro3DShaderChunk;
    Giro3dShaderChunk.giro3d_precision_qualifiers = giro3d_precision_qualifiers;
    Giro3dShaderChunk.giro3d_common = giro3d_common;
    Giro3dShaderChunk.giro3d_outline_pars_fragment = giro3d_outline_pars_fragment;
    Giro3dShaderChunk.giro3d_outline_fragment = giro3d_outline_fragment;
    Giro3dShaderChunk.giro3d_compose_layers_pars_fragment = giro3d_compose_layers_pars_fragment;
    Giro3dShaderChunk.giro3d_colormap_pars_fragment = giro3d_colormap_pars_fragment;
    Giro3dShaderChunk.giro3d_contour_line_pars_fragment = giro3d_contour_line_pars_fragment;
    Giro3dShaderChunk.giro3d_contour_line_fragment = giro3d_contour_line_fragment;
    Giro3dShaderChunk.giro3d_fragment_shader_header = giro3d_fragment_shader_header;
    Giro3dShaderChunk.giro3d_graticule_fragment = giro3d_graticule_fragment;
    Giro3dShaderChunk.giro3d_graticule_pars_fragment = giro3d_graticule_pars_fragment;
    Giro3dShaderChunk.giro3d_hillshading_pars_fragment = giro3d_hillshading_pars_fragment;
    Giro3dShaderChunk.giro3d_intersecting_volume_pars = giro3d_intersecting_volume_pars;
    Giro3dShaderChunk.giro3d_terrain_pars_vertex = giro3d_terrain_pars_vertex;
    Giro3dShaderChunk.giro3d_terrain_vertex = giro3d_terrain_vertex;
}
