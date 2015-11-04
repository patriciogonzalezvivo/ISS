// Author @patriciogv ( patriciogonzalezvivo.com ) - 2015

#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D u_tex0;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

float circle(vec2 _st, float _radius){
  vec2 pos = vec2(0.5)-_st;
  _radius *= 0.75;
  return 1.-step(_radius,dot(pos,pos)*3.14);
}

void main(){

  vec2 st = gl_FragCoord.xy/u_resolution.xy;
  st.x *= u_resolution.x/u_resolution.y;
  vec2 pos = st;

  float zoom = 15.;
  st *= zoom;
  if (fract(st.y * 0.5) > 0.5){
      st.x += 0.5;
  }
  vec2 st_f = fract(st);
  vec2 st_i = floor(st);

  float pattern = texture2D(u_tex0,st_i/zoom).r;
  pattern = circle(st_f, pow(pattern,2.)*.6);

  gl_FragColor = vec4(pattern);
}