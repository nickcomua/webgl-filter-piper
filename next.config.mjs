/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    reactCompiler: true,
    turbo: {
      rules: {
        // This will match all .frag, .vert, and .glsl files in your project
        '**/*.{frag,vert,glsl}': {
          loaders: ['raw-loader'],
          as: 'js', // or as: '*.js'
        },
      },
    },
  },
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.(frag|vert|glsl)$/,
      use: 'raw-loader',
    });
    return config;
  },
}

export default nextConfig
