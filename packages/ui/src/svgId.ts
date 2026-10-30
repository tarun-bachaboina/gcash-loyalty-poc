import { useId } from 'react';

/** useId() output sanitised for use inside SVG url(#…) references. */
export const useSvgId = () => useId().replace(/[^a-zA-Z0-9_-]/g, '');
