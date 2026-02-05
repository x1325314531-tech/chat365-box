// 主类：WebGLFingerprintProtection
class WebGLFingerprintProtection {
  constructor() {
    this.originalContexts = {
      'webgl': null,
      'webgl2': null
    };
    this.fakeFingerprint = this.generateFakeFingerprint();
    this.hookState = {
      isHooked: false,
      isDetectable: true,  // 控制是否可被检测
      isSpoofed: true,     // 控制是否已伪装
    };
  }
  
  // 生成随机的、但非唯一的假指纹
  generateFakeFingerprint() {
    const gpuVendors = [
      'Intel Inc.', 'NVIDIA Corporation', 'AMD', 'Apple', 'Qualcomm',
      'Mesa', 'VMware', 'Microsoft Corporation'
    ];
    const gpuModels = [
      'Intel(R) HD Graphics 630', 'GeForce GTX 1080', 'Radeon RX 580',
      'Apple M1 GPU', 'Adreno 650', 'Mesa DRI Intel(R) HD Graphics',
      'SVGA3D; build: RELEASE;  LLVM;', 'Microsoft Basic Render Driver'
    ];
    const osTypes = ['Windows', 'Mac OS', 'Linux', 'Android', 'iOS'];
    const driverVersions = [
      '26.20.100.8141', '456.71', '20.9.1', '17.7.1', '512.0',
      '20.1.5', '15.1.0', '10.0.19041.1'
    ];
    
    const randomVendor = gpuVendors[Math.floor(Math.random() * gpuVendors.length)];
    const randomModel = gpuModels[Math.floor(Math.random() * gpuModels.length)];
    const randomOS = osTypes[Math.floor(Math.random() * osTypes.length)];
    const randomDriver = driverVersions[Math.floor(Math.random() * driverVersions.length)];
    
    return {
      vendor: randomVendor,
      renderer: randomModel,
      driverVersion: randomDriver,
      os: randomOS,
      screenWidth: 1920 + Math.floor(Math.random() * 200) - 100,
      screenHeight: 1080 + Math.floor(Math.random() * 200) - 100,
      maxAnisotropy: 16,
      maxTextureSize: 16384,
      maxTextureUnits: 16,
      maxVertexUniforms: 4096,
      maxFragmentUniforms: 2048,
      maxVaryings: 30,
      maxViewportDims: [16384, 16384],
      supportedExtensions: this.generateFakeExtensions(randomOS, randomVendor)
    };
  }
  
  generateFakeExtensions(os, vendor) {
    const allExtensions = [
      'EXT_blend_minmax', 'EXT_frag_depth', 'EXT_shader_texture_lod',
      'EXT_texture_filter_anisotropic', 'OES_element_index_uint',
      'OES_standard_derivatives', 'OES_texture_float', 'OES_texture_float_linear',
      'OES_texture_half_float', 'OES_texture_half_float_linear', 'OES_vertex_array_object',
      'WEBGL_color_buffer_float', 'WEBGL_compressed_texture_s3tc',
      'WEBGL_compressed_texture_s3tc_srgb', 'WEBGL_debug_renderer_info',
      'WEBGL_debug_shaders', 'WEBGL_depth_texture', 'WEBGL_draw_buffers',
      'WEBGL_lose_context', 'ANGLE_instanced_arrays', 'EXT_color_buffer_float',
      'EXT_disjoint_timer_query', 'EXT_float_blend', 'WEBGL_compressed_texture_astc',
      'WEBGL_compressed_texture_etc', 'WEBGL_compressed_texture_etc1',
      'WEBGL_compressed_texture_pvrtc', 'WEBKIT_WEBGL_compressed_texture_pvrtc',
      'WEBGL_compressed_texture_s3tc', 'WEBGL_debug_renderer_info',
      'WEBGL_debug_shaders', 'WEBGL_depth_texture', 'WEBGL_draw_buffers',
      'WEBGL_lose_context'
    ];
    
    // 根据操作系统和GPU厂商过滤扩展
    const osSpecificExtensions = {
      'Windows': ['EXT_texture_filter_anisotropic', 'WEBGL_compressed_texture_s3tc', 'EXT_color_buffer_float'],
      'Mac OS': ['WEBGL_compressed_texture_astc', 'EXT_disjoint_timer_query', 'EXT_float_blend'],
      'Linux': ['EXT_texture_filter_anisotropic', 'OES_texture_float', 'WEBGL_depth_texture'],
      'Android': ['WEBGL_compressed_texture_etc', 'WEBGL_compressed_texture_pvrtc', 'EXT_disjoint_timer_query'],
      'iOS': ['WEBGL_compressed_texture_pvrtc', 'WEBKIT_WEBGL_compressed_texture_pvrtc', 'EXT_disjoint_timer_query']
    };
    
    const vendorSpecificExtensions = {
      'Intel': ['EXT_texture_filter_anisotropic', 'WEBGL_compressed_texture_s3tc'],
      'NVIDIA': ['WEBGL_compressed_texture_s3tc', 'EXT_color_buffer_float', 'EXT_float_blend'],
      'AMD': ['WEBGL_compressed_texture_s3tc', 'EXT_disjoint_timer_query'],
      'Apple': ['WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_pvrtc']
    };
    
    let extensions = [...allExtensions];
    
    // 添加OS特定扩展
    if (osSpecificExtensions[os]) {
      extensions = extensions.filter(ext => 
        !osSpecificExtensions[os].includes(ext) || Math.random() > 0.3
      );
    }
    
    // 添加厂商特定扩展
    Object.keys(vendorSpecificExtensions).forEach(key => {
      if (vendor.includes(key) && vendorSpecificExtensions[key]) {
        extensions = extensions.filter(ext =>
          !vendorSpecificExtensions[key].includes(ext) || Math.random() > 0.3
        );
      }
    });
    
    // 随机移除一些扩展，使其看起来更真实
    return extensions.filter(() => Math.random() > 0.2);
  }
  
  // Hook WebGL API
  hookWebGL() {
    if (this.hookState.isHooked) {
      console.warn('WebGL API 已经被Hook过了');
      return;
    }
    
    this.hookState.isHooked = true;
    
    // 保存原始上下文
    this.originalContexts.webgl = window.WebGLRenderingContext;
    this.originalContexts.webgl2 = window.WebGL2RenderingContext;
    
    // Hook getContext
    this.hookGetContext();
    
    // Hook WebGLRenderingContext
    this.hookWebGLRenderingContext();
    
    // Hook WebGL2RenderingContext
    this.hookWebGL2RenderingContext();
    
    console.log('WebGL API Hook 已激活');
  }
  
  // 解除Hook
  unhookWebGL() {
    if (!this.hookState.isHooked) {
      return;
    }
    
    // 恢复原始上下文
    if (this.originalContexts.webgl) {
      window.WebGLRenderingContext = this.originalContexts.webgl;
    }
    
    if (this.originalContexts.webgl2) {
      window.WebGL2RenderingContext = this.originalContexts.webgl2;
    }
    
    // 恢复getContext
    HTMLCanvasElement.prototype.getContext = this.originalGetContext;
    
    this.hookState.isHooked = false;
    console.log('WebGL API Hook 已解除');
  }
  
  hookGetContext() {
    const self = this;
    this.originalGetContext = HTMLCanvasElement.prototype.getContext;
    
    HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
      const isWebGL = contextType === 'webgl' || contextType === 'experimental-webgl';
      const isWebGL2 = contextType === 'webgl2';
      
      if ((isWebGL || isWebGL2) && self.hookState.isSpoofed) {
        // 获取原始上下文
        const originalContext = self.originalGetContext.call(this, contextType, contextAttributes);
        
        if (!originalContext) {
          return null;
        }
        
        if (isWebGL) {
          return self.createSpoofedWebGLContext(originalContext);
        } else if (isWebGL2) {
          return self.createSpoofedWebGL2Context(originalContext);
        }
      }
      
      // 非WebGL上下文，或者未启用伪装
      return self.originalGetContext.call(this, contextType, contextAttributes);
    };
  }
  
  createSpoofedWebGLContext(originalContext) {
    const self = this;
    const spoofedContext = {};
    
    // 创建代理对象
    const handler = {
      get(target, prop) {
        // Hook getParameter
        if (prop === 'getParameter') {
          return function(pname) {
            return self.spoofGetParameter.call(self, pname, target, 'webgl');
          };
        }
        
        // Hook getSupportedExtensions
        if (prop === 'getSupportedExtensions') {
          return function() {
            return self.fakeFingerprint.supportedExtensions;
          };
        }
        
        // Hook getExtension
        if (prop === 'getExtension') {
          return function(extensionName) {
            return self.spoofGetExtension.call(self, extensionName, target, 'webgl');
          };
        }
        
        // Hook getContextAttributes
        if (prop === 'getContextAttributes') {
          return function() {
            const originalAttrs = target.getContextAttributes();
            if (originalAttrs) {
              // 伪装一些属性
              return {
                ...originalAttrs,
                powerPreference: 'default',
                failIfMajorPerformanceCaveat: false
              };
            }
            return originalAttrs;
          };
        }
        
        // Hook canvas
        if (prop === 'canvas') {
          return target.canvas;
        }
        
        // Hook drawingBufferWidth/Height
        if (prop === 'drawingBufferWidth' || prop === 'drawingBufferHeight') {
          return target[prop];
        }
        
        // 其他属性/方法，直接返回
        const value = target[prop];
        
        if (typeof value === 'function') {
          return value.bind(target);
        }
        
        return value;
      },
      
      set(target, prop, value) {
        target[prop] = value;
        return true;
      }
    };
    
    return new Proxy(originalContext, handler);
  }
  
  createSpoofedWebGL2Context(originalContext) {
    const self = this;
    
    const handler = {
      get(target, prop) {
        // Hook getParameter
        if (prop === 'getParameter') {
          return function(pname) {
            return self.spoofGetParameter.call(self, pname, target, 'webgl2');
          };
        }
        
        // Hook getSupportedExtensions
        if (prop === 'getSupportedExtensions') {
          return function() {
            return self.fakeFingerprint.supportedExtensions.concat([
              'EXT_color_buffer_float', 'EXT_disjoint_timer_query_webgl2',
              'OES_texture_float_linear', 'WEBGL_compressed_texture_astc',
              'WEBGL_compressed_texture_etc', 'WEBGL_compressed_texture_etc1'
            ]);
          };
        }
        
        // Hook getExtension
        if (prop === 'getExtension') {
          return function(extensionName) {
            return self.spoofGetExtension.call(self, extensionName, target, 'webgl2');
          };
        }
        
        // Hook getInternalformatParameter
        if (prop === 'getInternalformatParameter') {
          return function(...args) {
            return self.spoofGetInternalformatParameter.call(self, ...args, target, 'webgl2');
          };
        }
        
        const value = target[prop];
        
        if (typeof value === 'function') {
          return value.bind(target);
        }
        
        return value;
      }
    };
    
    return new Proxy(originalContext, handler);
  }
  
  // 伪装的getParameter实现
  spoofGetParameter(pname, originalContext, contextType) {
    const fake = this.fakeFingerprint;
    
    // WebGL 常量
    const GL = originalContext.constructor;
    
    switch(pname) {
      // 渲染器信息
      case GL.VENDOR:
      case 0x1F00: // UNMASKED_VENDOR_WEBGL
        return fake.vendor;
        
      case GL.RENDERER:
      case 0x1F01: // UNMASKED_RENDERER_WEBGL
        return fake.renderer;
        
      case GL.VERSION:
        return contextType === 'webgl' 
          ? 'WebGL 1.0' 
          : 'WebGL 2.0';
        
      case GL.SHADING_LANGUAGE_VERSION:
        return contextType === 'webgl'
          ? 'WebGL GLSL ES 1.0'
          : 'WebGL GLSL ES 3.00';
        
      // 最大纹理尺寸
      case GL.MAX_TEXTURE_SIZE:
        return fake.maxTextureSize;
        
      case GL.MAX_CUBE_MAP_TEXTURE_SIZE:
        return fake.maxTextureSize;
        
      case GL.MAX_RENDERBUFFER_SIZE:
        return fake.maxTextureSize;
        
      // 纹理单元数量
      case GL.MAX_COMBINED_TEXTURE_IMAGE_UNITS:
        return fake.maxTextureUnits;
        
      case GL.MAX_TEXTURE_IMAGE_UNITS:
        return fake.maxTextureUnits;
        
      case GL.MAX_VERTEX_TEXTURE_IMAGE_UNITS:
        return 16;
        
      // 着色器限制
      case GL.MAX_VERTEX_UNIFORM_VECTORS:
        return fake.maxVertexUniforms;
        
      case GL.MAX_FRAGMENT_UNIFORM_VECTORS:
        return fake.maxFragmentUniforms;
        
      case GL.MAX_VARYING_VECTORS:
        return fake.maxVaryings;
        
      // 视口和渲染缓冲
      case GL.MAX_VIEWPORT_DIMS:
        return new Int32Array(fake.maxViewportDims);
        
      case GL.ALIASED_LINE_WIDTH_RANGE:
        return new Float32Array([1, 1]);
        
      case GL.ALIASED_POINT_SIZE_RANGE:
        return new Float32Array([1, 2048]);
        
      // 各向异性过滤
      case 0x84FE: // MAX_TEXTURE_MAX_ANISOTROPY_EXT
        return fake.maxAnisotropy;
        
      // WebGL2 特定参数
      case 0x8B4D: // MAX_3D_TEXTURE_SIZE
        return 2048;
        
      case 0x8B4C: // MAX_ARRAY_TEXTURE_LAYERS
        return 256;
        
      case 0x8B49: // MAX_DRAW_BUFFERS
        return 8;
        
      case 0x8B4A: // MAX_COLOR_ATTACHMENTS
        return 8;
        
      default:
        // 对于其他参数，返回真实值
        try {
          return originalContext.getParameter(pname);
        } catch(e) {
          // 如果获取失败，返回一个合理的默认值
          return this.getDefaultParameterValue(pname, contextType);
        }
    }
  }
  
  getDefaultParameterValue(pname, contextType) {
    const defaults = {
      // WebGL1
      0x0BC0: 4,   // RED_BITS
      0x0BC1: 4,   // GREEN_BITS
      0x0BC2: 4,   // BLUE_BITS
      0x0BC3: 8,   // ALPHA_BITS
      0x0BC4: 24,  // DEPTH_BITS
      0x0BC5: 8,   // STENCIL_BITS
      0x1F03: false, // UNPACK_FLIP_Y_WEBGL
      0x9240: false, // UNPACK_PREMULTIPLY_ALPHA_WEBGL
      // WebGL2
      0x821B: 8,   // MAX_COMBINED_UNIFORM_BLOCKS
      0x8A2E: 36,  // MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS
      0x8A2F: 16,  // MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS
    };
    
    return defaults[pname] || 0;
  }
  
  // 伪装的getExtension实现
  spoofGetExtension(extensionName, originalContext, contextType) {
    const self = this;
    const supported = this.fakeFingerprint.supportedExtensions;
    
    // 检查是否是支持的扩展
    if (!supported.includes(extensionName)) {
      return null;
    }
    
    // 获取原始扩展
    const originalExtension = originalContext.getExtension(extensionName);
    
    if (!originalExtension) {
      return null;
    }
    
    // 对特定扩展进行特殊处理
    if (extensionName === 'WEBGL_debug_renderer_info') {
      return {
        UNMASKED_VENDOR_WEBGL: 0x9246,
        UNMASKED_RENDERER_WEBGL: 0x9247,
        getExtension: function() { return this; },
        getParameter: function(pname) {
          if (pname === 0x9246) {
            return self.fakeFingerprint.vendor;
          } else if (pname === 0x9247) {
            return self.fakeFingerprint.renderer;
          }
          return null;
        }
      };
    }
    
    // 创建扩展的代理
    return new Proxy(originalExtension, {
      get(target, prop) {
        if (prop === 'getParameter' && extensionName === 'EXT_texture_filter_anisotropic') {
          return function(pname) {
            if (pname === 0x84FE) { // MAX_TEXTURE_MAX_ANISOTROPY_EXT
              return self.fakeFingerprint.maxAnisotropy;
            }
            return target[prop] ? target[prop].call(target, pname) : null;
          };
        }
        
        const value = target[prop];
        if (typeof value === 'function') {
          return value.bind(target);
        }
        return value;
      }
    });
  }
  
  // WebGL2 的 getInternalformatParameter
  spoofGetInternalformatParameter(target, ...args) {
    try {
      return target.getInternalformatParameter.apply(target, args);
    } catch(e) {
      // 返回合理的默认值
      return [4, 4, 4, 4]; // RGBA格式
    }
  }
}