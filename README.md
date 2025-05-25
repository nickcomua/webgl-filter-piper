# GPU-Pipelined Image Processing System

A high-performance, cross-platform image processing application built with WebGL/GLSL for real-time GPU-accelerated image filtering and manipulation. This project demonstrates advanced GPU computing techniques through a modern web interface.

## 🎯 Project Overview

This application is part of a Bachelor's Thesis in Computer Engineering, showcasing cross-platform GPU computing capabilities using OpenGL/GLSL shaders. The system implements a sophisticated filter pipeline that processes images entirely on the GPU, minimizing CPU-GPU data transfer overhead.

## ✨ Features

### 🖼️ Image Processing
- **Real-time GPU Processing**: All filters execute on GPU using WebGL fragment shaders
- **Pipeline Architecture**: Chain multiple filters with optimized framebuffer ping-ponging
- **Zero CPU Overhead**: Images stay in VRAM throughout the entire processing pipeline
- **High Performance**: Optimized for real-time processing of high-resolution images

### 🎛️ Filter Library
- **Color Adjustments**: Brightness, Contrast, Saturation
- **Convolution Filters**: Gaussian Blur, Sharpen, Edge Detection
- **Advanced Filters**: Bilateral Filter, Noise Reduction
- **Debug Tools**: Red tint overlay for pipeline debugging

### 🔧 User Interface
- **Drag & Drop**: Intuitive image loading
- **Live Preview**: Real-time filter adjustment with immediate feedback
- **Pipeline Management**: Add, remove, reorder, and toggle filters
- **Performance Metrics**: GPU time, memory usage, and throughput monitoring
- **Responsive Design**: Works on desktop and mobile devices

## 🛠️ Technology Stack

- **Frontend**: React 18+ with TypeScript
- **Graphics**: WebGL 1.0/2.0 with custom GLSL shaders
- **UI Components**: Tailwind CSS + Radix UI
- **Build Tool**: Next.js 14+
- **State Management**: React Hooks

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Modern browser with WebGL support
- Graphics card with OpenGL 3.0+ support

## 🚀 Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/gpu-image-processing.git
cd gpu-image-processing
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Start development server**
```bash
npm run dev
# or
yarn dev
```

4. **Open browser**
Navigate to `http://localhost:3000`

## 📖 Usage Guide

### Basic Workflow

1. **Load Image**: Click "Load Image" or drag & drop an image file
2. **Add Filters**: Go to the "Library" tab and click + to add filters to your pipeline
3. **Adjust Parameters**: Use sliders to fine-tune filter settings in real-time
4. **Toggle Filters**: Enable/disable individual filters to compare results
5. **Export Result**: Save the processed image when satisfied

### Filter Parameters

| Filter | Parameters | Description |
|--------|------------|-------------|
| **Brightness** | `value` (-50 to 50) | Adjusts image brightness |
| **Contrast** | `value` (0.1 to 3.0) | Controls contrast ratio |
| **Saturation** | `value` (0 to 3.0) | Color saturation intensity |
| **Gaussian Blur** | `radius` (0.5 to 5.0) | Blur kernel size |
| **Sharpen** | `strength` (0 to 3.0) | Sharpening intensity |
| **Edge Detection** | `threshold` (0.1 to 2.0) | Edge sensitivity |
| **Noise Reduction** | `strength` (0 to 1.0) | Smoothing intensity |
| **Bilateral Filter** | `spatial` (0.5 to 3.0), `color` (0.01 to 1.0) | Advanced edge-preserving smoothing |

## 🔧 Technical Architecture

### WebGL Processing Pipeline

```
Input Image → GPU Texture → Filter 1 → Framebuffer 1 → Filter 2 → Framebuffer 2 → ... → Screen
```

### Key Components

#### `WebGLProcessor`
- Manages WebGL context and resources
- Handles shader compilation and program linking
- Implements framebuffer ping-ponging for multi-pass rendering
- Optimizes texture memory management

#### `ReglSurface`
- React component wrapper for WebGL processing
- Manages WebGL lifecycle and cleanup
- Handles image loading and texture creation
- Provides fallback to Canvas 2D when WebGL unavailable

#### Filter System
- Modular GLSL fragment shaders
- Configurable parameters with validation
- Real-time parameter updates without recompilation

### Performance Optimizations

- **Framebuffer Reuse**: Ping-pong between two framebuffers to minimize allocations
- **Shader Caching**: Compiled programs are cached and reused
- **Texture Streaming**: Optimized texture upload with proper pixel formats
- **Memory Management**: Automatic cleanup of WebGL resources

## 🎨 Shader Development

### Adding Custom Filters

1. **Define GLSL Fragment Shader**
```glsl
precision mediump float;
uniform sampler2D u_image;
uniform float u_customParam;
varying vec2 v_texCoord;

void main() {
  vec3 color = texture2D(u_image, v_texCoord).rgb;
  // Apply your custom processing here
  gl_FragColor = vec4(color, 1.0);
}
```

2. **Add to Shader Registry**
```typescript
const shaders = {
  customFilter: `
    // Your GLSL code here
  `
};
```

3. **Define Filter Template**
```typescript
{
  id: "customFilter",
  name: "Custom Filter",
  type: "custom",
  defaultParams: { customParam: 1.0 },
  paramConfig: {
    customParam: { min: 0, max: 2, step: 0.1 }
  }
}
```

## 📊 Performance Metrics

The application provides real-time performance monitoring:

- **GPU Time**: Pure shader execution time
- **Total Time**: Complete processing pipeline duration
- **VRAM Usage**: Graphics memory consumption
- **Throughput**: Data processing rate (MB/s)

## 🌐 Browser Compatibility

| Browser | WebGL 1.0 | WebGL 2.0 | Status |
|---------|-----------|-----------|--------|
| Chrome 90+ | ✅ | ✅ | Fully Supported |
| Firefox 88+ | ✅ | ✅ | Fully Supported |
| Safari 14+ | ✅ | ✅ | Fully Supported |
| Edge 90+ | ✅ | ✅ | Fully Supported |

## 🔍 Troubleshooting

### Common Issues

**WebGL Not Available**
- Ensure hardware acceleration is enabled in browser settings
- Update graphics drivers
- Try a different browser

**Poor Performance**
- Reduce image resolution
- Limit number of active filters
- Check available VRAM

**Shader Compilation Errors**
- Check browser console for detailed error messages
- Verify GLSL syntax in custom shaders

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-filter`)
3. Commit your changes (`git commit -m 'Add amazing filter'`)
4. Push to the branch (`git push origin feature/amazing-filter`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write performant GLSL shaders
- Add proper error handling
- Include performance tests for new filters
- Update documentation

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎓 Academic Context

This project is submitted as part of a Bachelor's Thesis in Computer Engineering, focusing on:

- Cross-platform GPU computing techniques
- Real-time image processing algorithms
- WebGL/OpenGL performance optimization
- Modern web application architecture

## 🙏 Acknowledgments

- WebGL specification and documentation
- GLSL shader programming community
- React and TypeScript ecosystems
- Academic advisors and peers

---

**Made with ❤️ for high-performance image processing**