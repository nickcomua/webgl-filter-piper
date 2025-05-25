import React, { useRef, useEffect } from "react";

export interface FilterTemplate {
    id: string;
    name: string;
    type: string;
    defaultParams: { [key: string]: number };
    paramConfig: {
        [key: string]: {
            min: number;
            max: number;
            step: number;
        }
    };
}

export interface Filter {
    id: string;
    name: string;
    type: string;
    parameters: { [key: string]: number };
    enabled: boolean;
    paramConfig?: {
        [key: string]: {
            min: number;
            max: number;
            step: number;
        }
    };
}

interface ReglSurfaceProps {
  image: string | null;
  pipeline: Filter[];
  width: number;
  height: number;
}

const basicVertexShader = `
attribute vec2 a_position;
varying vec2 v_texCoord;

void main() {
  // Simple texture coordinate mapping without Y-flip
  v_texCoord = vec2(a_position.x * 0.5 + 0.5, a_position.y * 0.5 + 0.5);
  gl_Position = vec4(a_position, 0, 1);
}
`;

const shaders = {
  passthrough: `
    precision mediump float;
    uniform sampler2D u_image;
    varying vec2 v_texCoord;
    void main() {
      gl_FragColor = texture2D(u_image, v_texCoord);
    }
  `,
  
  debug: `
    precision mediump float;
    uniform sampler2D u_image;
    varying vec2 v_texCoord;
    void main() {
      vec3 color = texture2D(u_image, v_texCoord).rgb;
      color.r = min(color.r + 0.5, 1.0);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  
  brightness: `
    precision mediump float;
    uniform sampler2D u_image;
    uniform float u_value;
    varying vec2 v_texCoord;
    void main() {
      vec3 color = texture2D(u_image, v_texCoord).rgb;
      color += u_value * 0.01;
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,
  
  contrast: `
    precision mediump float;
    uniform sampler2D u_image;
    uniform float u_value;
    varying vec2 v_texCoord;
    void main() {
      vec3 color = texture2D(u_image, v_texCoord).rgb;
      color = (color - 0.5) * u_value + 0.5;
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,
  
  saturation: `
    precision mediump float;
    uniform sampler2D u_image;
    uniform float u_value;
    varying vec2 v_texCoord;
    void main() {
      vec3 color = texture2D(u_image, v_texCoord).rgb;
      float gray = dot(color, vec3(0.299, 0.587, 0.114));
      vec3 saturated = mix(vec3(gray), color, u_value);
      gl_FragColor = vec4(clamp(saturated, 0.0, 1.0), 1.0);
    }
  `,
  
  blur: `
    precision mediump float;
    uniform sampler2D u_image;
    uniform float u_radius;
    uniform vec2 u_resolution;
    varying vec2 v_texCoord;
    void main() {
      vec2 texelSize = 1.0 / u_resolution;
      vec3 color = vec3(0.0);
      float totalWeight = 0.0;
      for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
          vec2 offset = vec2(float(x), float(y)) * texelSize * u_radius;
          color += texture2D(u_image, v_texCoord + offset).rgb;
          totalWeight += 1.0;
        }
      }
      gl_FragColor = vec4(color / totalWeight, 1.0);
    }
  `,
  
  sharpen: `
    precision mediump float;
    uniform sampler2D u_image;
    uniform float u_strength;
    uniform vec2 u_resolution;
    varying vec2 v_texCoord;
    void main() {
      vec2 texelSize = 1.0 / u_resolution;
      vec3 center = texture2D(u_image, v_texCoord).rgb;
      vec3 blur = (
        texture2D(u_image, v_texCoord + vec2(-texelSize.x, 0.0)).rgb +
        texture2D(u_image, v_texCoord + vec2(texelSize.x, 0.0)).rgb +
        texture2D(u_image, v_texCoord + vec2(0.0, -texelSize.y)).rgb +
        texture2D(u_image, v_texCoord + vec2(0.0, texelSize.y)).rgb
      ) * 0.25;
      vec3 sharpened = center + (center - blur) * u_strength;
      gl_FragColor = vec4(clamp(sharpened, 0.0, 1.0), 1.0);
    }
  `,
  
  edge: `
    precision mediump float;
    uniform sampler2D u_image;
    uniform float u_threshold;
    uniform vec2 u_resolution;
    varying vec2 v_texCoord;
    void main() {
      vec2 texelSize = 1.0 / u_resolution;
      vec3 tl = texture2D(u_image, v_texCoord + vec2(-texelSize.x, -texelSize.y)).rgb;
      vec3 tm = texture2D(u_image, v_texCoord + vec2(0.0, -texelSize.y)).rgb;
      vec3 tr = texture2D(u_image, v_texCoord + vec2(texelSize.x, -texelSize.y)).rgb;
      vec3 ml = texture2D(u_image, v_texCoord + vec2(-texelSize.x, 0.0)).rgb;
      vec3 mr = texture2D(u_image, v_texCoord + vec2(texelSize.x, 0.0)).rgb;
      vec3 bl = texture2D(u_image, v_texCoord + vec2(-texelSize.x, texelSize.y)).rgb;
      vec3 bm = texture2D(u_image, v_texCoord + vec2(0.0, texelSize.y)).rgb;
      vec3 br = texture2D(u_image, v_texCoord + vec2(texelSize.x, texelSize.y)).rgb;
      vec3 gx = -tl + tr - 2.0*ml + 2.0*mr - bl + br;
      vec3 gy = -tl - 2.0*tm - tr + bl + 2.0*bm + br;
      float magnitude = length(gx) + length(gy);
      float edge = step(u_threshold, magnitude);
      gl_FragColor = vec4(vec3(edge), 1.0);
    }
  `,
  
  noise: `
    precision mediump float;
    uniform sampler2D u_image;
    uniform float u_strength;
    uniform vec2 u_resolution;
    varying vec2 v_texCoord;
    void main() {
      vec2 texelSize = 1.0 / u_resolution;
      vec3 center = texture2D(u_image, v_texCoord).rgb;
      vec3 sum = vec3(0.0);
      sum += texture2D(u_image, v_texCoord + vec2(-texelSize.x, -texelSize.y)).rgb;
      sum += texture2D(u_image, v_texCoord + vec2(0.0, -texelSize.y)).rgb;
      sum += texture2D(u_image, v_texCoord + vec2(texelSize.x, -texelSize.y)).rgb;
      sum += texture2D(u_image, v_texCoord + vec2(-texelSize.x, 0.0)).rgb;
      sum += texture2D(u_image, v_texCoord).rgb;
      sum += texture2D(u_image, v_texCoord + vec2(texelSize.x, 0.0)).rgb;
      sum += texture2D(u_image, v_texCoord + vec2(-texelSize.x, texelSize.y)).rgb;
      sum += texture2D(u_image, v_texCoord + vec2(0.0, texelSize.y)).rgb;
      sum += texture2D(u_image, v_texCoord + vec2(texelSize.x, texelSize.y)).rgb;
      vec3 filtered = sum / 9.0;
      vec3 result = mix(center, filtered, u_strength);
      gl_FragColor = vec4(result, 1.0);
    }
  `,
  
  bilateral: `
    precision mediump float;
    uniform sampler2D u_image;
    uniform float u_spatial;
    uniform float u_color;
    uniform vec2 u_resolution;
    varying vec2 v_texCoord;
    void main() {
      vec2 texelSize = 1.0 / u_resolution;
      vec3 centerColor = texture2D(u_image, v_texCoord).rgb;
      vec3 sum = vec3(0.0);
      float totalWeight = 0.0;
      for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
          vec2 offset = vec2(float(x), float(y)) * texelSize;
          vec3 sampleColor = texture2D(u_image, v_texCoord + offset).rgb;
          float spatialDist = length(vec2(float(x), float(y)));
          float colorDist = length(sampleColor - centerColor);
          float spatialWeight = exp(-spatialDist * spatialDist / (2.0 * u_spatial * u_spatial));
          float colorWeight = exp(-colorDist * colorDist / (2.0 * u_color * u_color));
          float weight = spatialWeight * colorWeight;
          sum += sampleColor * weight;
          totalWeight += weight;
        }
      }
      if (totalWeight > 0.0) {
        gl_FragColor = vec4(sum / totalWeight, 1.0);
      } else {
        gl_FragColor = vec4(centerColor, 1.0);
      }
    }
  `
};

class WebGLProcessor {
  private gl: WebGLRenderingContext;
  private programs: Map<string, WebGLProgram> = new Map();
  private framebuffers: WebGLFramebuffer[] = [];
  private textures: WebGLTexture[] = [];
  private positionBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;

  constructor(canvas: HTMLCanvasElement) {
    console.log("🎮 Initializing WebGL context...");
    
    const gl = canvas.getContext('webgl', {
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: false
    }) ?? canvas.getContext('experimental-webgl', {
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: false
    }) as WebGLRenderingContext;

    if (!gl) {
      throw new Error('WebGL not supported');
    }

    this.gl = gl;
    console.log("✅ WebGL context created");
    console.log("  - Version:", gl.getParameter(gl.VERSION));
    console.log("  - Renderer:", gl.getParameter(gl.RENDERER));
    console.log("  - Vendor:", gl.getParameter(gl.VENDOR));

    this.setupGeometry();
  }

  private setupGeometry() {
    const gl = this.gl;
    
    // Create vertex buffer (full-screen quad)
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    const positions = new Float32Array([
      -1, -1,
       1, -1,
       1,  1,
      -1,  1
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Create index buffer
    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    const indices = new Uint16Array([0, 1, 2, 2, 3, 0]);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    console.log("✅ Geometry buffers created");
  }

  private compileShader(source: string, type: number): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation error: ${error}`);
    }

    return shader;
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    
    const vertexShader = this.compileShader(vertexSource, gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(fragmentSource, gl.FRAGMENT_SHADER);

    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create program');

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program linking error: ${error}`);
    }

    // Clean up shaders
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
  }

  private getProgram(fragmentShader: string): WebGLProgram {
    if (!this.programs.has(fragmentShader)) {
      const program = this.createProgram(basicVertexShader, fragmentShader);
      this.programs.set(fragmentShader, program);
      console.log("✅ Shader program compiled and cached");
    }
    return this.programs.get(fragmentShader)!;
  }

  createTexture(image: HTMLImageElement): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create texture');

    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Set pixel store parameters to handle Y-flipping correctly
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.textures.push(texture);
    console.log("✅ Input texture created with Y-flip");
    return texture;
  }

  createFramebuffer(width: number, height: number): { framebuffer: WebGLFramebuffer, texture: WebGLTexture } {
    const gl = this.gl;
    
    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create framebuffer texture');
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Framebuffer textures don't need Y-flipping
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) throw new Error('Failed to create framebuffer');
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer not complete');
    }

    this.framebuffers.push(framebuffer);
    this.textures.push(texture);
    
    return { framebuffer, texture };
  }

  renderFilter(
    inputTexture: WebGLTexture,
    fragmentShader: string,
    uniforms: { [key: string]: any },
    framebuffer: WebGLFramebuffer | null,
    width: number,
    height: number
  ) {
    const gl = this.gl;
    const program = this.getProgram(fragmentShader);

    // Bind framebuffer (null for screen)
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, width, height);

    // Use program
    gl.useProgram(program);

    // Set up attributes
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Bind input texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);

    // Set uniforms
    Object.entries(uniforms).forEach(([name, value]) => {
      const location = gl.getUniformLocation(program, name);
      if (location !== null) {
        if (name === 'u_image') {
          gl.uniform1i(location, 0); // Texture unit 0
        } else if (name === 'u_resolution') {
          gl.uniform2f(location, value[0], value[1]);
        } else if (typeof value === 'number') {
          gl.uniform1f(location, value);
        }
      }
    });

    // Draw
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  clear() {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  destroy() {
    const gl = this.gl;
    
    // Clean up programs
    this.programs.forEach(program => gl.deleteProgram(program));
    this.programs.clear();
    
    // Clean up framebuffers
    this.framebuffers.forEach(fb => gl.deleteFramebuffer(fb));
    this.framebuffers = [];
    
    // Clean up textures
    this.textures.forEach(texture => gl.deleteTexture(texture));
    this.textures = [];
    
    // Clean up buffers
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);
    
    console.log("✅ WebGL resources cleaned up");
  }
}

function getShaderForFilter(filterId: string): string {
  const baseId = filterId.split('-')[0];
  console.log(`🔍 Getting shader for filter: ${filterId} -> ${baseId}`);
  return shaders[baseId as keyof typeof shaders] || shaders.passthrough;
}

export function ReglSurface({ image, pipeline, width, height }: ReglSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    console.log("🚀 WebGL Surface useEffect triggered");
    console.log("📊 Props:", { image: !!image, pipelineLength: pipeline.length, width, height });
    
    if (!image || !canvasRef.current) {
      console.log("❌ Missing image or canvas ref");
      return;
    }
    
    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;
    console.log(`📏 Canvas dimensions set: ${width}x${height}`);
    
    let processor: WebGLProcessor | null = null;
    
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      console.log("🖼️ Image loaded successfully");
      console.log(`📐 Image dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
      
      if (!canvasRef.current) return;
      
      try {
        processor = new WebGLProcessor(canvas);
        
        // Create input texture
        const inputTexture = processor.createTexture(img);
        
        // Create framebuffers for ping-pong rendering
        const fbo1 = processor.createFramebuffer(width, height);
        const fbo2 = processor.createFramebuffer(width, height);
        
        // Process pipeline
        const enabledFilters = pipeline.filter(filter => filter.enabled);
        console.log(`🔧 Processing ${enabledFilters.length} enabled filters`);
        
        if (enabledFilters.length === 0) {
          // Just render the image
          processor.clear();
          processor.renderFilter(
            inputTexture,
            shaders.passthrough,
            { u_image: inputTexture },
            null,
            width,
            height
          );
          console.log("✅ Image rendered (no filters)");
        } else {
          processor.clear();
          
          let currentTexture = inputTexture;
          let currentFBO = fbo1;
          let nextFBO = fbo2;
          
          enabledFilters.forEach((filter, index) => {
            console.log(`🎨 Processing filter ${index + 1}/${enabledFilters.length}: ${filter.name}`);
            console.log("📋 Filter parameters:", filter.parameters);
            
            const fragmentShader = getShaderForFilter(filter.id);
            const isLastFilter = index === enabledFilters.length - 1;
            
            // Build uniforms
            const uniforms: any = {
              u_image: currentTexture,
              u_resolution: [width, height]
            };
            
            // Add filter parameters
            Object.entries(filter.parameters).forEach(([key, value]) => {
              uniforms[`u_${key}`] = value;
              console.log(`📊 Uniform u_${key} = ${value}`);
            });
            
            // Render filter
            processor!.renderFilter(
              currentTexture,
              fragmentShader,
              uniforms,
              isLastFilter ? null : currentFBO.framebuffer,
              width,
              height
            );
            
            console.log(`✅ Filter rendered to ${isLastFilter ? 'screen' : 'framebuffer'}`);
            
            // Swap for next pass
            if (!isLastFilter) {
              currentTexture = currentFBO.texture;
              [currentFBO, nextFBO] = [nextFBO, currentFBO];
            }
          });
          
          console.log("🎉 All filters processed successfully");
        }
        
      } catch (error) {
        console.error('❌ Error during WebGL processing:', error);
        
        // Fallback to 2D canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          console.log("🔄 Falling back to Canvas 2D");
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
      }
    };
    
    img.onerror = (error) => {
      console.error('❌ Failed to load image:', error);
    };
    
    img.src = image;
    
    return () => {
      if (processor) {
        processor.destroy();
      }
    };
  }, [image, pipeline, width, height]);

  return (
    <div className="relative">
      <canvas 
        ref={canvasRef} 
        className="max-w-full h-auto border border-gray-300 rounded"
        style={{ 
          imageRendering: 'auto',
          backgroundColor: '#f9f9f9'
        }}
      />
      <div className="text-xs text-gray-500 mt-1">
        Native WebGL Processing {pipeline.filter(f => f.enabled).length > 0 ? `(${pipeline.filter(f => f.enabled).length} filters)` : '(Original)'}
      </div>
    </div>
  );
}