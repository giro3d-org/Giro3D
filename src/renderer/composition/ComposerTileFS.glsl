#include <giro3d_precision_qualifiers>
#include <giro3d_fragment_shader_header>
#include <giro3d_common>

varying vec2 vUv;

uniform Interpretation interpretation;
uniform sampler2D tex;
uniform sampler2D gridTexture;
uniform float opacity;
uniform bool flipY;
uniform NoDataOptions noDataOptions;
uniform bool showImageOutlines;
uniform bool isEmptyTexture;
uniform bool showEmptyTexture;
uniform bool convertRGFloatToRGBAUnsignedByte;
uniform int channelCount;
uniform bool expandRGB;
uniform float heightPrecision;
uniform float heightOffset;

void main() {
    vec2 uv = flipY
        ? vec2(vUv.x, 1.0 - vUv.y)
        : vUv;

    gl_FragColor = vec4(0, 0, 0, 0);

    if (!isEmptyTexture) {
        int alphaChannelLocation = channelCount - 1;

        if (noDataOptions.enabled) {
            gl_FragColor = texture2DFillNodata(tex, uv, noDataOptions, alphaChannelLocation);
        } else {
            vec4 color = texture2D(tex, uv);
            gl_FragColor = color;

            if (convertRGFloatToRGBAUnsignedByte) {
                gl_FragColor = convert_RG_Float_RGBA_UnsignedByte(gl_FragColor, heightPrecision, heightOffset);
            } else {
                gl_FragColor = decodeInterpretation(gl_FragColor, interpretation);
            }

            if(expandRGB) {
                gl_FragColor = grayscaleToRGB(gl_FragColor, interpretation);
            }

            // Transfer alpha channel to its new location
            gl_FragColor.a = color[alphaChannelLocation];
        }
    } else if (showEmptyTexture) {
        gl_FragColor = vec4(1, 0, 0, 0.5);
    }

    if (showImageOutlines && (!isEmptyTexture || showEmptyTexture)) {
        vec4 grid = texture2D(gridTexture, uv);
        gl_FragColor = blend(grid, gl_FragColor);
    }

    gl_FragColor.a *= opacity;

    #include <colorspace_fragment>
}
