import Image from 'next/image';

export default function UgsBrand() {
  return <span className="ugs-brand-lockup">
    <Image src="/brand/ugs-initials.png" alt="UGS" width={1774} height={887} unoptimized className="ugs-wordmark" />
    <span>Union Gaming Society</span>
  </span>;
}
