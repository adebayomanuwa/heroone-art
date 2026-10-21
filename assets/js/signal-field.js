/* Signal field: full-bleed WebGL aurora (gold / teal / indigo), a faint hex
   lattice revealed near the pointer, and drifting signal particles.
   Vanilla port of 333Bi Tech components/SignalField.tsx. No dependencies.
   Falls back to the CSS gradient underneath when WebGL is unavailable, draws
   a single frame under reduced motion, and idles off-screen or in a hidden tab. */
(function () {
  var VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";
  var FRAG = [
    "precision highp float;",
    "uniform vec2 uRes;uniform float uTime;uniform vec2 uPointer;",
    "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);",
    "return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}",
    "float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=0.5;}return v;}",
    "float hexLine(vec2 p){p*=vec2(1.0,1.1547);vec2 q=vec2(p.x+p.y*0.5,p.y);vec2 f=fract(q)-0.5;",
    "float d=max(abs(f.x),max(abs(f.y),abs(f.x+f.y)));return smoothstep(0.47,0.5,d);}",
    "void main(){",
    " vec2 uv=gl_FragCoord.xy/uRes.xy;vec2 p=(gl_FragCoord.xy-0.5*uRes.xy)/uRes.y;float t=uTime*0.045;",
    " vec2 q=vec2(fbm(p*1.4+t),fbm(p*1.4-t+3.1));float n=fbm(p*1.8+2.2*q+vec2(t*0.6,-t*0.4));",
    " vec3 ink=vec3(0.024,0.031,0.059);vec3 gold=vec3(0.788,0.659,0.298);vec3 teal=vec3(0.31,0.94,0.88);vec3 indigo=vec3(0.16,0.18,0.42);",
    " vec3 col=ink;col=mix(col,indigo,smoothstep(0.35,0.95,n)*0.5);",
    " col+=gold*pow(smoothstep(0.52,1.0,n),2.2)*0.6;col+=teal*pow(smoothstep(0.6,1.0,q.y),3.0)*0.14;",
    " vec2 m=(uPointer-0.5*uRes.xy)/uRes.y;float glow=exp(-6.0*length(p-m));col+=gold*glow*0.12;",
    " float lattice=hexLine(p*9.0+vec2(0.0,t*0.6));",
    " col+=mix(gold,teal,uv.x)*lattice*(0.018+glow*0.16)*smoothstep(0.3,0.8,n+glow);",
    " vec2 g=p*26.0+vec2(0.0,uTime*0.12);vec2 cell=floor(g);vec2 off=vec2(hash(cell),hash(cell+7.3))-0.5;",
    " float d=length(fract(g)-0.5-off*0.7);float tw=0.5+0.5*sin(uTime*1.3+hash(cell+3.0)*6.28);",
    " col+=mix(gold,teal,hash(cell+1.1))*smoothstep(0.06,0.0,d)*step(0.86,hash(cell+9.9))*tw*0.55;",
    " col*=1.0-0.55*pow(length(uv-0.5)*1.25,2.0);",
    " gl_FragColor=vec4(col,1.0);",
    "}"
  ].join("\n");

  function start(canvas) {
    var gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl || gl.isContextLost()) { canvas.dataset.state = "fallback"; return; }
    function compile(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.dataset.state = "fallback"; return; }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uRes = gl.getUniformLocation(prog, "uRes");
    var uTime = gl.getUniformLocation(prog, "uTime");
    var uPointer = gl.getUniformLocation(prog, "uPointer");

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    var scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.6;
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    var raf = 0, visible = true, t0 = performance.now();

    function resize() {
      var w = Math.max(1, Math.floor(canvas.clientWidth * scale));
      var h = Math.max(1, Math.floor(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
      if (!pointer.x && !pointer.y) { pointer.x = pointer.tx = w * 0.68; pointer.y = pointer.ty = h * 0.55; }
    }
    function frame(now) {
      resize();
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, reduce.matches ? 12 : (now - t0) / 1000);
      gl.uniform2f(uPointer, pointer.x, pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = visible && !reduce.matches ? requestAnimationFrame(frame) : 0;
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    window.addEventListener("pointermove", function (e) {
      var r = canvas.getBoundingClientRect();
      pointer.tx = (e.clientX - r.left) * scale;
      pointer.ty = (r.height - (e.clientY - r.top)) * scale;
      if (reduce.matches) kick();
    }, { passive: true });
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting && !document.hidden;
      if (visible) kick();
    }).observe(canvas);
    document.addEventListener("visibilitychange", function () { visible = !document.hidden; if (visible) kick(); });
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; canvas.dataset.state = "fallback"; });
    if (reduce.addEventListener) reduce.addEventListener("change", kick);
    kick();
    requestAnimationFrame(function () { if (canvas.dataset.state !== "fallback") canvas.dataset.state = "ready"; });
  }

  document.querySelectorAll("[data-signal-field] canvas").forEach(start);
})();
