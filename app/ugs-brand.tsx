import Image from 'next/image';

export default function UgsBrand() {
  return <span className="ugs-brand-lockup">
    <Image src="/brand/ugs-logo-192.png" alt="UGS" width={192} height={192} unoptimized className="ugs-wordmark" />
    <span>Union Gaming Society</span>
  </span>;
}
