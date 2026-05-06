/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The polished UI is a thin proxy in front of FastAPI. We don't compile any
  // server-side Anthropic / Google API calls here — those stay in Python.
};

export default nextConfig;
