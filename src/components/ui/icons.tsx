import type { IconProps } from "@/types";

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ size = 16, ...props }: IconProps) {
  return <svg width={size} height={size} aria-hidden focusable="false" {...props} />;
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <circle cx="11" cy="11" r="6.4" />
      <path d="M15.8 15.8 20 20" />
    </Svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M4 10.6 12 4.4l8 6.2V19a1 1 0 0 1-1 1h-4v-5.2H9V20H5a1 1 0 0 1-1-1z" />
    </Svg>
  );
}

export function QuizIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <rect x="3.6" y="5" width="16.8" height="15" rx="2.4" />
      <path d="M8 3.4v3.2M16 3.4v3.2M3.6 10h16.8" />
      <path d="M9.4 14.6l1.5 1.5 3.3-3.3" />
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <circle cx="12" cy="12" r="2.9" />
      <path d="M19.3 14.4a1.6 1.6 0 0 0 .32 1.76l.06.06a1.9 1.9 0 1 1-2.69 2.69l-.06-.06a1.6 1.6 0 0 0-1.76-.32 1.6 1.6 0 0 0-.97 1.47v.17a1.9 1.9 0 1 1-3.8 0v-.09a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.76.32l-.06.06a1.9 1.9 0 1 1-2.69-2.69l.06-.06a1.6 1.6 0 0 0 .32-1.76 1.6 1.6 0 0 0-1.47-.97h-.17a1.9 1.9 0 1 1 0-3.8h.09A1.6 1.6 0 0 0 5.4 9.1a1.6 1.6 0 0 0-.32-1.76l-.06-.06A1.9 1.9 0 1 1 7.71 4.6l.06.06a1.6 1.6 0 0 0 1.76.32h.08a1.6 1.6 0 0 0 .97-1.47v-.17a1.9 1.9 0 1 1 3.8 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.76-.32l.06-.06a1.9 1.9 0 1 1 2.69 2.69l-.06.06a1.6 1.6 0 0 0-.32 1.76v.08a1.6 1.6 0 0 0 1.47.97h.17a1.9 1.9 0 1 1 0 3.8h-.09a1.6 1.6 0 0 0-1.47.97z" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...base} strokeWidth={1.8} {...props}>
      <path d="M6.5 9.5 12 15l5.5-5.5" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...base} strokeWidth={1.8} {...props}>
      <path d="M9.5 6.5 15 12l-5.5 5.5" />
    </Svg>
  );
}

export function MoreHorizontalIcon(props: IconProps) {
  return (
    <Svg {...base} strokeWidth={2} {...props}>
      <circle cx="5.4" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="18.6" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function PaperclipIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M17.6 8.9 10 16.5a3 3 0 0 1-4.24-4.24l7.4-7.4a2 2 0 0 1 2.83 2.83l-7.4 7.4" />
    </Svg>
  );
}

export function ImagePlusIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <rect x="3.4" y="4.6" width="12.2" height="12.2" rx="2.2" />
      <path d="M3.8 14.2 7 11.4l3 2.4 2.6-2.2 2.6 2.2" />
      <path d="M19.6 6.6v5.2M17 9.2h5.2" />
    </Svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <circle cx="12" cy="12" r="7.6" />
      <path d="M4.6 12h14.8" />
      <path d="M12 4.4c2 2.1 3 4.7 3 7.6s-1 5.5-3 7.6c-2-2.1-3-4.7-3-7.6s1-5.5 3-7.6z" />
    </Svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <rect x="9.4" y="3.4" width="5.2" height="9.2" rx="2.6" />
      <path d="M6.6 11.2a5.4 5.4 0 0 0 10.8 0" />
      <path d="M12 16.6V20M9.4 20h5.2" />
    </Svg>
  );
}

export function WaveformIcon(props: IconProps) {
  return (
    <Svg {...base} strokeWidth={1.9} {...props}>
      <path d="M4.4 10.4v3.2M8 7.6v8.8M11.6 9.4v5.2M15.2 6.6v10.8M18.8 10v4" />
    </Svg>
  );
}

export function CommandIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M8.6 8.6h6.8v6.8H8.6z" />
      <path d="M8.6 8.6H7a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 2.1 2.1v2.1M15.4 8.6H17a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0-2.1 2.1v2.1M8.6 15.4H7a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 2.1-2.1v-2.1M15.4 15.4H17a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1-2.1-2.1v-2.1" />
    </Svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M12 3.4l1.7 5.1 5.1 1.7-5.1 1.7L12 17l-1.7-5.1L5.2 10.2l5.1-1.7z" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...base} strokeWidth={1.9} {...props}>
      <path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6" />
    </Svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...base} strokeWidth={1.9} {...props}>
      <path d="M4.4 7.2h15.2M4.4 12h15.2M4.4 16.8h15.2" />
    </Svg>
  );
}

export function PanelIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.4" />
      <path d="M9.6 4.6v14.8" />
    </Svg>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <Svg {...base} strokeWidth={1.9} {...props}>
      <path d="M12 19V5.6M6.4 11.2 12 5.6l5.6 5.6" />
    </Svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M12 15.4V4.8M7.6 9.2 12 4.8l4.4 4.4" />
      <path d="M4.6 14.6v3.2a1.8 1.8 0 0 0 1.8 1.8h11.2a1.8 1.8 0 0 0 1.8-1.8v-3.2" />
    </Svg>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M6.4 3.4h7l4.2 4.2v13H6.4a1.4 1.4 0 0 1-1.4-1.4V4.8a1.4 1.4 0 0 1 1.4-1.4z" />
      <path d="M13.2 3.6v4.2h4.2" />
      <path d="M8.6 13.4h6.8M8.6 16.6h4.4" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M5 6.6h14M9.6 6.6V4.9a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1v1.7" />
      <path d="M6.6 6.6l.8 12a1.4 1.4 0 0 0 1.4 1.3h5.4a1.4 1.4 0 0 0 1.4-1.3l.8-12" />
      <path d="M10.4 10.4v6M13.6 10.4v6" />
    </Svg>
  );
}

export function DatabaseIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <ellipse cx="12" cy="6.4" rx="7" ry="3" />
      <path d="M5 6.4v11.2c0 1.66 3.13 3 7 3s7-1.34 7-3V6.4" />
      <path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" />
    </Svg>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M12 3.8 3.8 8 12 12.2 20.2 8z" />
      <path d="M3.8 12.6 12 16.8l8.2-4.2M3.8 16.8 12 21l8.2-4.2" />
    </Svg>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M5 8h9M18 8h1M5 16h1M10 16h9" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="8" cy="16" r="2" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.6V12l3 1.9" />
    </Svg>
  );
}

export function ShuffleIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M4.4 7.2h3.1l3 4.8 3-4.8h5.4" />
      <path d="M16.4 4.6l2.6 2.6-2.6 2.6" />
      <path d="M4.4 16.8h3.1l3-4.8" />
      <path d="M13.5 12.8l3 4h3.4" />
      <path d="M16.4 19.6l2.6-2.8-2.6-2.8" />
    </Svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M4.6 4.6h6a2.2 2.2 0 0 1 2.2 2.2v13a1.8 1.8 0 0 0-1.8-1.8H4.6z" />
      <path d="M20.2 4.6h-6A2.2 2.2 0 0 0 12 6.8v13a1.8 1.8 0 0 1 1.8-1.8h6.4z" />
    </Svg>
  );
}

export function GraduationIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M12 4.8 3.4 8.8 12 12.8l8.6-4z" />
      <path d="M7 11v4.6c0 1.4 2.24 2.6 5 2.6s5-1.2 5-2.6V11" />
      <path d="M20.6 8.8v5.4" />
    </Svg>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M10.7 4.4 3.5 17a1.5 1.5 0 0 0 1.3 2.2h14.4a1.5 1.5 0 0 0 1.3-2.2L13.3 4.4a1.5 1.5 0 0 0-2.6 0z" />
      <path d="M12 9.4v4M12 16.4h.01" />
    </Svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5M12 8.2h.01" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...base} strokeWidth={1.9} {...props}>
      <path d="M12 5.6v12.8M5.6 12h12.8" />
    </Svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Svg {...base} strokeWidth={1.9} {...props}>
      <path d="M5.6 12h12.8" />
    </Svg>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <Svg {...base} strokeWidth={1.8} {...props}>
      <path d="M6.5 14.5 12 9l5.5 5.5" />
    </Svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M5.2 19.6a6.8 6.8 0 0 1 13.6 0" />
    </Svg>
  );
}

export function PaletteIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M12 3.6a8.4 8.4 0 0 0 0 16.8c1.3 0 2-.9 2-1.9 0-.6-.3-1-.6-1.4-.3-.4-.6-.8-.6-1.4 0-1 .8-1.8 1.9-1.8h1.6a3.7 3.7 0 0 0 3.7-3.7c0-3.6-3.6-6.6-8-6.6z" />
      <circle cx="8.4" cy="10.4" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8.4" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="10.4" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M20 12.4c0 3.7-3.6 6.7-8 6.7-.9 0-1.8-.1-2.6-.4L5 20.4l1-3.2a6.3 6.3 0 0 1-2-4.4c0-3.7 3.6-6.7 8-6.7s8 2.6 8 6.3z" />
    </Svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M19 12H5.6M11.2 6.4 5.6 12l5.6 5.6" />
    </Svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M9.6 19.2a2.4 2.4 0 0 0 4.8 0" />
      <path d="M6.2 16.4h11.6l-1.2-2.1v-3a4.6 4.6 0 1 0-9.2 0v3z" />
    </Svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M12 3.6 5.4 6v5.6c0 3.6 2.6 6.9 6.6 8.8 4-1.9 6.6-5.2 6.6-8.8V6z" />
      <path d="M9.4 12.2l1.8 1.8 3.6-3.8" />
    </Svg>
  );
}

export function PlugIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M9 3.6v5M15 3.6v5" />
      <path d="M6.6 8.6h10.8v2.6a5.4 5.4 0 0 1-5.4 5.4 5.4 5.4 0 0 1-5.4-5.4z" />
      <path d="M12 16.6v3.8" />
    </Svg>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.4" />
      <path d="M7.6 9.6l2.6 2.4-2.6 2.4M12.8 14.4h3.6" />
    </Svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M2.8 12S6 6.4 12 6.4 21.2 12 21.2 12 18 17.6 12 17.6 2.8 12 2.8 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </Svg>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M4.4 4.4l15.2 15.2" />
      <path d="M9.6 5.2A9.6 9.6 0 0 1 12 5c5.9 0 9.1 5.6 9.1 5.6a15 15 0 0 1-3.1 3.7" />
      <path d="M6.3 7.3A15.6 15.6 0 0 0 2.9 10.6S6.1 16.2 12 16.2a9.4 9.4 0 0 0 3.4-.6" />
      <path d="M10.3 10.4a2.4 2.4 0 0 0 3.4 3.4" />
    </Svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M12 4.4v10.8M7.6 10.8 12 15.2l4.4-4.4" />
      <path d="M4.6 16.6v2.2a1 1 0 0 0 1 1h12.8a1 1 0 0 0 1-1v-2.2" />
    </Svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.9-2.9a3.6 3.6 0 0 0-5.1-5.1l-1.4 1.4" />
      <path d="M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.9 2.9a3.6 3.6 0 0 0 5.1 5.1l1.4-1.4" />
    </Svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <path d="M19.4 12a7.4 7.4 0 1 1-2.2-5.2" />
      <path d="M19.6 5.2v4.2h-4.2" />
    </Svg>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.6 12.3l2.4 2.4 4.4-4.8" />
    </Svg>
  );
}