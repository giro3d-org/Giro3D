varying vec3 vWorldPosition;

uniform vec3 sunPosition;

uniform float skyDomeLuminance;
uniform float turbidity;
uniform float rayleighCoefficient;
uniform float mieCoefficient;
uniform float mieDirectionalG;
uniform float sunAngularDiameterCos;

uniform vec3 up;
// original value = 0.999956676946448443553574619906976478926848692873900859324;
// 66 arc seconds -> degrees, and the cosine of that

// constants for atmospheric scattering
const float e = 2.71828182845904523536028747135266249775724709369995957;
const float pi = 3.141592653589793238462643383279502884197169;

const float n = 1.0003; // refractive index of air
const float N = 2.545E25; // number of molecules per unit volume for air at
// 288.15K and 1013mb (sea level -45 celsius)
const float pn = 0.035; // depolatization factor for standard air

// wavelength of used primaries, according to preetham
const vec3 lambda = vec3(680E-9, 550E-9, 450E-9);

// mie stuff
// K coefficient for the primaries
const vec3 K = vec3(0.686, 0.678, 0.666);
const float v = 4.0;

// optical length at zenith for molecules
const float rayleighZenithLength = 8.4E3;
const float mieZenithLength = 1.25E3;

const float EE = 1000.0;

// earth shadow hack
const float cutoffAngle = pi / 1.95;
const float steepness = 1.5;

vec3 totalRayleigh(vec3 lambda) {
    return (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn));
}

// see http://blenderartists.org/forum/showthread.php?321110-Shaders-and-Skybox-madness
// A simplied version of the total Reayleigh scattering to works on browsers that use ANGLE
vec3 simplifiedRayleigh() {
    return 0.0005 / vec3(94, 40, 18);
        // return 0.00054532832366 / (3.0 * 2.545E25 * pow(vec3(680E-9, 550E-9, 450E-9), vec3(4.0)) * 6.245);
}

float rayleighPhase(float cosTheta) {
    return (3.0 / (16.0 * pi)) * (1.0 + pow(cosTheta, 2.0));
}

vec3 totalMie(vec3 lambda, vec3 K, float T) {
    float c = (0.2 * T) * 10E-18;
    return 0.434 * c * pi * pow((2.0 * pi) / lambda, vec3(v - 2.0)) * K;
}

float hgPhase(float cosTheta, float g) {
    return (1.0 / (4.0 * pi)) * ((1.0 - pow(g, 2.0)) / pow(1.0 - 2.0 * g * cosTheta + pow(g, 2.0), 1.5));
}

float sunIntensity(float zenithAngleCos) {
    float angle = cutoffAngle - acos(zenithAngleCos);

    float exp = exp(-(angle / steepness));

    return EE * max(0.0, 1.0 - exp);
}

// Filmic ToneMapping http://filmicgames.com/archives/75
float A = 0.15;
float B = 0.50;
float C = 0.10;
float D = 0.20;
float E = 0.02;
float F = 0.30;
float W = 1000.0;

vec3 Uncharted2Tonemap(vec3 x) {
    return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}

const float earthRadius = 6400000.0;

void main() {
    // The direction toward the sun
    vec3 sunDirection = normalize(sunPosition - cameraPosition);

    // The direction toward the fragment's location in the sky
    vec3 skyDirection = normalize(vWorldPosition - cameraPosition);

    // The angle between the sun and the up vector: (sunset = 1, zenith = 0)
    float zenithAngleCos = dot(sunDirection, up);

    // Sun fade: the fading intensity of the sun, depends on the sun angle
    float sunfade = 1.0 - clamp(1.0 - exp(zenithAngleCos), 0.0, 1.0);

    //  The Rayleigh coefficient combined with sun fade
    float rayleighCoefficient2 = rayleighCoefficient - (1.0 * (1.0 - sunfade));

    // The sun intensity depending on the sun angle
    float sunE = sunIntensity(zenithAngleCos);

    // extinction (absorbtion + out scattering)
    // rayleigh coefficients
    vec3 betaR = simplifiedRayleigh() * rayleighCoefficient2;

    // Mie coefficients
    vec3 betaM = totalMie(lambda, K, turbidity) * mieCoefficient;

    // optical length
    // cutoff angle at 90 to avoid singularity in next formula.
    float a = dot(up, skyDirection);
    float zenithAngle = acos(max(0.0, a));
    float cosZenithAngle = cos(zenithAngle);

    float sR = rayleighZenithLength / (cosZenithAngle + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253));
    float sM = mieZenithLength / (cosZenithAngle + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253));

    // combined extinction factor
    vec3 Fex = exp(-(betaR * sR + betaM * sM));

    // in scattering
    float cosTheta = dot(skyDirection, sunDirection);

    float rPhase = rayleighPhase(cosTheta * 0.5 + 0.5);
    vec3 betaRTheta = betaR * rPhase;

    float mPhase = hgPhase(cosTheta, mieDirectionalG);
    vec3 betaMTheta = betaM * mPhase;

    vec3 skyColor = pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * (1.0 - Fex), vec3(1.5));
    skyColor *= mix(vec3(1.0), pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * Fex, vec3(1.0 / 2.0)), clamp(pow(1.0 - dot(up, sunDirection), 5.0), 0.0, 1.0));

    vec3 sunDiscColor = vec3(0.1) * Fex;

    // composition + solar disc
    //if (cosTheta > sunAngularDiameterCos)
    float sundisk = smoothstep(sunAngularDiameterCos, sunAngularDiameterCos * 1.2, cosTheta);
    // if (normalize(vWorldPosition - cameraPosition).y>0.0)
    sunDiscColor += (sunE * 19000.0 * Fex) * sundisk;

    vec3 whiteScale = 1.0 / Uncharted2Tonemap(vec3(W));

    vec3 texColor = (skyColor + sunDiscColor);
    texColor *= 0.04;
    texColor += vec3(0.0, 0.001, 0.0025) * 0.3;

    float g_fMaxLuminance = 1.0;
    float fLumScaled = 0.1 / skyDomeLuminance;
    float fLumCompressed = (fLumScaled * (1.0 + (fLumScaled / (g_fMaxLuminance * g_fMaxLuminance)))) / (1.0 + fLumScaled);

    float ExposureBias = fLumCompressed;

    vec3 curr = Uncharted2Tonemap((log2(2.0 / pow(skyDomeLuminance, 4.0))) * texColor);
    vec3 color = curr * whiteScale;

    vec3 retColor = pow(color, vec3(1.0 / (1.2 + (1.2 * sunfade))));

    gl_FragColor.rgb = retColor;

    gl_FragColor.a = 1. - ((length(cameraPosition) - earthRadius) / 1000.);
}
