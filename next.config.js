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
            value: "frame-ancestors 'self' https://www.figma.com https://figma.com",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
