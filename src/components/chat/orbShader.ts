export const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;

vec3 palette(float t) {
  vec3 deep = vec3(0.090, 0.100, 0.210);
  vec3 indigo = vec3(0.210, 0.235, 0.520);
  vec3 violet = vec3(0.480, 0.390, 0.800);
  vec3 rose = vec3(0.945, 0.585, 0.530);
  vec3 cream = vec3(0.995, 0.925, 0.865);

  vec3 a = mix(deep, indigo, smoothstep(0.00, 0.30, t));
  vec3 b = mix(a, violet, smoothstep(0.28, 0.56, t));
  vec3 c = mix(b, rose, smoothstep(0.58, 0.82, t));
  return mix(c, cream, smoothstep(0.84, 1.0, t));
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 uv = (vUv - 0.5) * vec2(aspect, 1.0);

  float radius = 0.44;
  float dist = length(uv);

  float aa = fwidth(dist) * 1.25;
  float mask = 1.0 - smoothstep(radius - aa, radius + aa, dist);
  if (mask <= 0.001) {
    fragColor = vec4(0.0);
    return;
  }

  float time = uTime * 0.11;

  vec2 p = uv / radius;
  float z = sqrt(max(1.0 - dot(p, p), 0.0));
  vec3 n = normalize(vec3(p, z));

  vec3 lightDir = normalize(vec3(-0.40, 0.26, 0.88));
  float diffuse = clamp(dot(n, lightDir) * 0.5 + 0.5, 0.0, 1.0);

  vec3 bounceDir = normalize(vec3(0.62, -0.40, 0.68));
  float bounce = clamp(dot(n, bounceDir), 0.0, 1.0);

  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfVec = normalize(lightDir + viewDir);
  float spec = pow(max(dot(n, halfVec), 0.0), 46.0);

  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 5.0);

  float flow =
    sin(p.x * 2.6 + time * 1.5 + p.y * 1.2) * 0.40 +
    sin(p.y * 3.4 - time * 1.0 - p.x * 1.8) * 0.24 +
    sin((p.x + p.y) * 2.0 + time * 0.6) * 0.14 +
    sin(p.x * 5.2 - time * 0.9) * 0.08;

  float radiusNorm = clamp(dist / radius, 0.0, 1.0);
  float t = clamp(
    0.20 + diffuse * 0.66 + flow * 0.22 - radiusNorm * 0.08,
    0.0,
    1.0
  );

  vec3 color = palette(t);

  color += vec3(0.38, 0.42, 0.88) * bounce * 0.18;
  color += vec3(1.0, 0.90, 0.82) * spec * 0.22;
  color += vec3(0.52, 0.57, 1.0) * fresnel * 0.17;

  float limb = smoothstep(0.68, 1.0, radiusNorm);
  color *= 1.0 - limb * 0.18;

  fragColor = vec4(color * mask, mask);
}`;