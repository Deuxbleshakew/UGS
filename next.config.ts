import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: { cpus: 2 },
  async headers(){return [{source:'/:path*',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'no-referrer'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'},
    {key:'Content-Security-Policy',value:"base-uri 'self'; object-src 'none'; frame-ancestors 'none'"},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=()'},
  ]}];},
};

export default nextConfig;
