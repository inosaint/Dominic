/** @type {import('next').NextConfig} */
const nextConfig = {
  // Figma plugin UI is loaded in an iframe, so we need to allow framing
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
