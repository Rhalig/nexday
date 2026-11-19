import type { ReactNode } from 'react'

export type IconName =
  | 'sun'
  | 'inbox'
  | 'calendar'
  | 'tasks'
  | 'notes'
  | 'habits'
  | 'plus'
  | 'search'
  | 'bell'
  | 'refresh'
  | 'clock'
  | 'bolt'
  | 'check'
  | 'target'
  | 'link'
  | 'mail'
  | 'hash'
  | 'git'
  | 'x'
  | 'file'
  | 'tray'
  | 'chevronLeft'
  | 'chevronRight'
  | 'calendarLg'
  | 'list'
  | 'heading'
  | 'squareRound'
  | 'checkSquare'
  | 'noteLines'
  | 'linkChain'
  | 'expand'
  | 'share'
  | 'caretRight'
  | 'docPlain'
  | 'chevronDown'
  | 'copy'
  | 'arrowRight'
  | 'arrowLeft'
  | 'folder'
  | 'trash'
  | 'video'
  | 'gear'
  | 'keyboard'
  | 'helpCircle'
  | 'signOut'
  | 'moon'
  | 'syncSm'
  | 'checkCircle'
  | 'lines'
  | 'book'
  | 'sunSm'
  | 'more'

const paths: Record<IconName, ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </>
  ),
  tasks: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  notes: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </>
  ),
  habits: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15z" />
      <path d="M10 21h4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  check: <path d="M5 12l5 5 9-10" />,
  target: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  hash: <path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18" />,
  git: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="8" r="2.5" />
      <path d="M6 8.5v7M18 10.5c0 4-6 3-12 5" />
    </>
  ),
  x: <path d="M18 6L6 18M6 6l12 12" />,
  file: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </>
  ),
  tray: (
    <>
      <path d="M4 13l3-8h10l3 8v6H4z" />
      <path d="M4 13h5l1 2h4l1-2h5" />
    </>
  ),
  chevronLeft: <path d="M15 18l-6-6 6-6" />,
  chevronRight: <path d="M9 18l6-6-6-6" />,
  calendarLg: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  list: <path d="M5 6h14M5 12h14M5 18h9" />,
  heading: <path d="M6 5v14M18 5v14M6 12h12" />,
  squareRound: <rect x="4" y="4" width="16" height="16" rx="4" />,
  checkSquare: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  noteLines: (
    <>
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h4" />
    </>
  ),
  linkChain: (
    <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
  ),
  expand: <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  share: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0113 0M17 5.5a3.5 3.5 0 010 6M21.5 20a6.5 6.5 0 00-4-6" />
    </>
  ),
  caretRight: <path d="M9 6l6 6-6 6" />,
  docPlain: (
    <>
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M14 3v5h5" />
    </>
  ),
  chevronDown: <path d="M6 9l6 6 6-6" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </>
  ),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 18l-6-6 6-6" />,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  video: (
    <>
      <rect x="3" y="7" width="12" height="10" rx="2.5" />
      <path d="M15 11l6-3v8l-6-3" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </>
  ),
  keyboard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" />
    </>
  ),
  helpCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2M12 17h.01" />
    </>
  ),
  signOut: <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />,
  moon: <path d="M20 14A8 8 0 1110 4a6.5 6.5 0 0010 10z" />,
  syncSm: <path d="M20 12a8 8 0 11-2.3-5.6M20 4v5h-5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  lines: <path d="M4 5h16M4 12h16M4 19h10" />,
  book: <path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13" />,
  sunSm: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </>
  )
}

type Props = {
  name: IconName
  size?: number
  strokeWidth?: number
  round?: boolean
}

export function Icon({ name, size = 16, strokeWidth = 1.8, round = false }: Props): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap={round ? 'round' : undefined}
      strokeLinejoin={round ? 'round' : undefined}
    >
      {paths[name]}
    </svg>
  )
}
