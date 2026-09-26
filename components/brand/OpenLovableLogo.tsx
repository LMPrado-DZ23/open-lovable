import { logoMarkSVG } from './logo-mark';

/** Open Lovable brand: the faceted heart mark plus the wordmark. */
export default function OpenLovableLogo({size = 28, withWordmark = true}: {size?: number; withWordmark?: boolean}) {
  return <span className="inline-flex items-center gap-[10px]">
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{__html: logoMarkSVG('ol-logo')}}/>
    {withWordmark && <span className="text-[17px] font-semibold tracking-tight text-[#1c1b22]">Open Lovable</span>}
  </span>;
}
