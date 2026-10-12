import type { SVGProps } from 'react';

const PATHS = {
  today:
    'M4 7h16M8 3v4m8-4v4M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm4 9 2 2 4-4',
  workout: 'M3 10v4m3-7v10m0-5h12m0-5v10m3-7v4',
  exercises: 'M5 4h11l3 3v13H5zM9 10h7M9 14h7M9 18h4',
  nutrition:
    'M12 8c-2-3-7-2-7 3 0 4 3 9 5 9 1 0 1-.5 2-.5s1 .5 2 .5c2 0 5-5 5-9 0-5-5-6-7-3Zm0 0c0-2 1-4 3-5',
  tracking: 'M4 20V10m6 10V4m6 16v-7m4 7H3',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.5a7.5 7.5 0 0 0-2.2 1.2l-2.4-1-2 3.5 2 1.5a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1c.7.5 1.4 1 2.2 1.3l.4 2.5h4l.4-2.5c.8-.3 1.5-.8 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-8V9M9 2h6m4.5 4.5L18 8',
} as const;

export type IconName = keyof typeof PATHS;

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

/** Icône au trait, prend la couleur du texte (currentColor). */
export function Icon({ name, size = 24, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
