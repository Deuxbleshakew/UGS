import Image from 'next/image';

export default function UgsBrand() {
  return <span className="ugs-brand-lockup">
    <Image src="/brand/ugs-orchid.png" alt="UGS" width={1254} height={1254} unoptimized className="ugs-wordmark" />
    <span>Union Gaming Society</span>
  </span>;
}
