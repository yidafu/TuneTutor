import type { IconSet } from '../geometry'

/**
 * 宫墙（Palace Red）图标集 —— 宫式方折：square 端头 + miter 接合，
 * 能直不曲、轴对称构图；签名语汇是「回纹方折」（环循直角弯）与
 * 「实心方点缀」（宫门方孔、方谱头、方斗齿心）。圆乐器（sax /
 * violin）保留必要曲线，但点缀与细节全部改方。
 * 2026-11 增补五件同样以方代圆：clarinet 方按孔直边喇叭、horn 方孔心、
 * trombone 回纹方折滑管、cello 方卷首、classical 方音孔。
 */
export const PALACE_ICON_SET: IconSet = {
  piano: {
    paths: (
      <>
        <rect x="3.2" y="5.6" width="17.6" height="12.8" />
        <path d="M8 5.6v6M12 5.6v6M16 5.6v6" />
      </>
    ),
  },
  sax: {
    paths: (
      <path d="M17.2 2.4L20.5 3.3L20.9 4.4L16.3 7.6L15 15.5L11 19.5L7.4 15.6L4 6.7L3.3 6.1L10.8 7.8L10.2 13.9L14.7 7.4L15.4 4.8Z" />
    ),
    accents: (
      <>
        <rect x="17.4" y="9" width="1.3" height="1.3" />
        <rect x="17" y="12.2" width="1.3" height="1.3" />
      </>
    ),
  },
  guitar: {
    paths: (
      <>
        <path d="M9.7 8.5C8 8.7 6.9 10.1 6.9 11.9 6.9 13.2 7.7 14.1 9 14.5 7.6 15.1 6.6 16.4 6.6 18 6.6 20.2 9 21.5 12 21.5 15 21.5 17.4 20.2 17.4 18 17.4 16.4 16.4 15.1 15 14.5 16.3 14.1 17.1 13.2 17.1 11.9 17.1 10.1 16 8.7 14.3 8.5Z" />
        <path d="M9.9 8.5V2.6h4.2V8.5" />
        <path d="M10.9 2.6V1.5M13.1 2.6V1.5" />
      </>
    ),
    accents: <rect x="10.9" y="14.3" width="2.2" height="2.2" />,
  },
  bass: {
    paths: (
      <>
        <rect x="7.3" y="11.3" width="9.4" height="10.1" rx="1.6" />
        <path d="M9.9 12V1.8h4.2V12" />
      </>
    ),
    accents: <rect x="10.3" y="16.4" width="3.4" height="1.4" />,
  },
  violin: {
    paths: (
      <>
        <path d="M12 9.2c-1.9 0-3.3 1.2-3.3 2.9 0 1 .5 1.8 1.2 2.5-1.2.7-2 1.9-2 3.3 0 2.2 1.8 3.9 4.1 3.9s4.1-1.7 4.1-3.9c0-1.4-.8-2.6-2-3.3.7-.7 1.2-1.5 1.2-2.5 0-1.7-1.4-2.9-3.3-2.9Z" />
        <path d="M12 9.2V4.8" />
      </>
    ),
    accents: <rect x="10.3" y="3" width="1.8" height="1.8" />,
  },
  flute: {
    paths: <rect x="2.8" y="9.8" width="18.4" height="4.4" rx="0.8" />,
    accents: (
      <>
        <rect x="5.4" y="9.1" width="1.7" height="1.7" />
        <rect x="11" y="11.3" width="1.1" height="1.1" />
        <rect x="14.2" y="11.3" width="1.1" height="1.1" />
      </>
    ),
  },
  trumpet: {
    paths: (
      <>
        <path d="M2.8 12h12.6" />
        <path d="M6.8 12V8.8M9.8 12V8.8M12.8 12V8.8" />
        <path d="M15.4 12l3.4-3.8M15.4 12l3.4 3.8" />
        <path d="M18.8 8.2v7.6" />
      </>
    ),
  },
  clarinet: {
    paths: (
      <>
        <rect x="10.3" y="5.4" width="3.4" height="11.9" />
        <path d="M10.3 5.4L11.1 2.6h1.8l.8 2.8" />
        <path d="M10.3 17.3L8.7 20.7h6.6l-1.6-3.4" />
      </>
    ),
    accents: (
      <>
        <rect x="11.4" y="8.6" width="1.2" height="1.2" />
        <rect x="11.4" y="12.4" width="1.2" height="1.2" />
      </>
    ),
  },
  horn: {
    paths: (
      <>
        <circle cx="10.2" cy="11.2" r="5" />
        <path d="M12.9 6.8L12.6 2.9l5.9 5.9-3.9-.3" />
        <path d="M6.7 14.8L3.7 16.6" />
      </>
    ),
    accents: <rect x="9.3" y="10.3" width="1.8" height="1.8" />,
  },
  trombone: {
    paths: (
      <>
        <path d="M14.2 10.2H5.3v3.8h8.9" />
        <path d="M8.8 10.2v3.8" />
        <path d="M14.2 10.2l4.4-4M14.2 14l4.4 4" />
        <path d="M18.6 6.2v11.8" />
      </>
    ),
  },
  cello: {
    paths: (
      <>
        <path d="M12 7c-2.2 0-3.9 1.3-3.9 3.1 0 1.1.6 2 1.5 2.7-1.5.8-2.5 2.2-2.5 3.8 0 2.4 2.2 4.2 4.9 4.2s4.9-1.8 4.9-4.2c0-1.6-1-3-2.5-3.8.9-.7 1.5-1.6 1.5-2.7 0-1.8-1.7-3.1-3.9-3.1Z" />
        <path d="M12 7V4.8" />
        <path d="M12 20.8v2" />
      </>
    ),
    accents: <rect x="11.2" y="2.6" width="1.6" height="1.6" />,
  },
  classical: {
    paths: (
      <>
        <path d="M9.7 8.5C8 8.7 7 10 7 11.8 7 13 7.5 14 8.4 14.6 7.2 15.3 6.4 16.5 6.4 18.1 6.4 20.3 8.9 21.6 12 21.6 15.1 21.6 17.6 20.3 17.6 18.1 17.6 16.5 16.8 15.3 15.6 14.6 16.5 14 17 13 17 11.8 17 10 16 8.7 14.3 8.5Z" />
        <path d="M9.7 8.5V2.8h4.6v5.7" />
        <path d="M9.7 4.2H8.2M14.3 4.2H15.8" />
      </>
    ),
    accents: <rect x="10.9" y="14.3" width="2.2" height="2.2" />,
  },
  play: {
    paths: <path d="M8 5.2 18.8 12 8 18.8Z" />,
    solid: true,
  },
  stop: {
    paths: <rect x="7" y="7" width="10" height="10" />,
    solid: true,
  },
  metro: {
    paths: (
      <>
        <path d="M9.6 3.6h4.8l3 15.6H6.6l3-15.6Z" />
        <path d="M12 15.4l3.2-10.6" />
      </>
    ),
    accents: <rect x="14.4" y="3" width="1.9" height="1.9" />,
  },
  loop: {
    paths: (
      <>
        <path d="M4 10.4V6h12.8" />
        <path d="M13.6 2.8 16.8 6l-3.2 3.2" />
        <path d="M20 13.6V18H7.2" />
        <path d="M10.4 21 7.2 17.8l3.2-3.2" />
      </>
    ),
  },
  gear: {
    paths: (
      <>
        <rect x="10" y="10" width="4" height="4" />
        <path d="M12 3.8v5.6M12 14.6v5.6M20.2 12h-5.6M9.4 12H3.8M17.4 6.6l-3 3M9.6 14.4l-3 3M17.4 17.4l-3-3M9.6 9.6l-3-3" />
      </>
    ),
  },
  folder: {
    paths: (
      <path d="M3.2 5.2h6.6l1.7 2.4h8.1a1.2 1.2 0 0 1 1.2 1.2v8.8a1.2 1.2 0 0 1-1.2 1.2H4.4a1.2 1.2 0 0 1-1.2-1.2V5.2Z" />
    ),
    accents: <rect x="14.6" y="12.4" width="1.9" height="1.9" />,
  },
  note: {
    paths: <path d="M9.4 17.7V6.2l9.4-2v11.3" />,
    accents: (
      <>
        <rect x="5.8" y="15.9" width="3.6" height="3.6" />
        <rect x="15.2" y="13.7" width="3.6" height="3.6" />
      </>
    ),
  },
  trash: {
    paths: (
      <>
        <path d="M4.4 6.6h15.2" />
        <path d="M9.6 6.6V5a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1v1.6" />
        <path d="M6.6 6.6l.6 12a1.6 1.6 0 0 0 1.6 1.5h6.4a1.6 1.6 0 0 0 1.6-1.5l.6-12" />
        <path d="M10.1 10.4v5.8M13.9 10.4v5.8" />
      </>
    ),
  },
  phones: {
    paths: <path d="M4 14.4v-2.2a8 8 0 0 1 16 0v2.2" />,
    accents: (
      <>
        <rect x="3.2" y="13.6" width="4.2" height="6.2" rx="0.9" />
        <rect x="16.6" y="13.6" width="4.2" height="6.2" rx="0.9" />
      </>
    ),
  },
  palette: {
    paths: (
      <>
        <path d="M8.4 3.8h7.2l4.6 4.6v7.2l-4.6 4.6H8.4l-4.6-4.6V8.4l4.6-4.6Z" />
        <path d="M13.2 17.6c0-1 .7-1.6 1.8-1.6h1.4" />
      </>
    ),
    accents: (
      <>
        <rect x="7.2" y="9.6" width="1.5" height="1.5" />
        <rect x="10.8" y="7" width="1.5" height="1.5" />
        <rect x="14.6" y="8.2" width="1.5" height="1.5" />
      </>
    ),
  },
}
