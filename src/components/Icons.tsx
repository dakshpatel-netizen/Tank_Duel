import React from 'react';
import type { PowerBoxItemId, TankClassId } from '../../shared/config';
import type { DecalId, TurretStyleId } from '../../shared/types';

export const TankDuelLogo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 640 132"
    className={className}
    role="img"
    aria-label="Tank Duel Online"
  >
    <defs>
      <linearGradient id="tdoGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00E5C3" />
        <stop offset="48%" stopColor="#00B8FF" />
        <stop offset="100%" stopColor="#7C5CFF" />
      </linearGradient>
      <linearGradient id="tdoGradGold" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FFC83D" />
        <stop offset="100%" stopColor="#FF8A00" />
      </linearGradient>
      <filter id="tdoGlow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#00B8FF" floodOpacity="0.45" />
      </filter>
    </defs>

    {/* Stylized Tank Silhouette Emblem Left */}
    <g transform="translate(14, 24)">
      <rect x="6" y="42" width="84" height="26" rx="10" fill="#1E293B" stroke="#00E5C3" strokeWidth="3" />
      <circle cx="22" cy="55" r="7" fill="#00E5C3" />
      <circle cx="48" cy="55" r="7" fill="#00E5C3" />
      <circle cx="74" cy="55" r="7" fill="#00E5C3" />
      <path d="M18 42 L28 24 L68 24 L78 42 Z" fill="url(#tdoGradMain)" />
      <rect x="34" y="10" width="32" height="16" rx="6" fill="#F5F7FF" />
      <rect x="62" y="14" width="38" height="8" rx="4" fill="#FFC83D" />
    </g>

    {/* Wordmark */}
    <text
      x="130"
      y="70"
      fontFamily="Fredoka, sans-serif"
      fontWeight="700"
      fontSize="58"
      letterSpacing="2"
      fill="#F5F7FF"
      filter="url(#tdoGlow)"
    >
      TANK DUEL
    </text>
    <rect x="132" y="84" width="484" height="4" rx="2" fill="url(#tdoGradMain)" opacity="0.8" />
    <text
      x="134"
      y="116"
      fontFamily="Fredoka, sans-serif"
      fontWeight="700"
      fontSize="26"
      letterSpacing="12"
      fill="url(#tdoGradGold)"
    >
      ONLINE ARENA
    </text>
  </svg>
);

export const ClassIcon: React.FC<{ classId: TankClassId; className?: string }> = ({
  classId,
  className = 'w-6 h-6',
}) => {
  if (classId === 'scout') {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 21h24l-3-6H8l-4 6Z" fill="currentColor" fillOpacity="0.18" />
        <path d="M12 15l2-5h7l2 5" />
        <path d="M21 12h8" />
        <path d="M5 10l4-3M3 14l4-1" stroke="#00E5C3" />
      </svg>
    );
  }
  if (classId === 'heavy') {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="16" width="26" height="9" rx="3" fill="currentColor" fillOpacity="0.22" />
        <rect x="7" y="9" width="14" height="7" rx="2" />
        <path d="M21 11h9M21 14h9" />
        <circle cx="8" cy="21" r="1.5" fill="currentColor" />
        <circle cx="16" cy="21" r="1.5" fill="currentColor" />
        <circle cx="24" cy="21" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="16" width="24" height="8" rx="4" fill="currentColor" fillOpacity="0.2" />
      <path d="M9 16l2-6h9l2 6" />
      <path d="M20 12h9" />
      <circle cx="9" cy="20" r="1.5" fill="currentColor" />
      <circle cx="16" cy="20" r="1.5" fill="currentColor" />
      <circle cx="23" cy="20" r="1.5" fill="currentColor" />
    </svg>
  );
};

export const PowerItemIcon: React.FC<{ itemId: PowerBoxItemId; className?: string }> = ({
  itemId,
  className = 'w-6 h-6',
}) => {
  switch (itemId) {
    case 'repair':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#3DDC84" strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#38BDF8" strokeWidth="2.2" strokeLinejoin="round">
          <path d="M12 3l7 3v5c0 4.5-3 8.2-7 9.8C8 19.2 5 15.5 5 11V6l7-3Z" fill="#38BDF8" fillOpacity="0.2" />
        </svg>
      );
    case 'rapid_fire':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 17l4-10M11 17l4-10M16 17l4-10" />
        </svg>
      );
    case 'triple_shot':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 19V5M12 19L5 7M12 19l7-12" />
          <circle cx="12" cy="5" r="1.6" fill="#38BDF8" />
          <circle cx="5" cy="7" r="1.6" fill="#38BDF8" />
          <circle cx="19" cy="7" r="1.6" fill="#38BDF8" />
        </svg>
      );
    case 'speed_boost':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#00E5C3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 3L5 14h6l-1 7 9-11h-6l0-7Z" fill="#00E5C3" fillOpacity="0.25" />
        </svg>
      );
    case 'damage_up':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#C084FC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l2.6 5.4L20 9.2l-4 4 .9 5.8L12 16.2 7.1 19l.9-5.8-4-4 5.4-.8L12 3Z" fill="#C084FC" fillOpacity="0.25" />
        </svg>
      );
    case 'homing':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#FFC83D" strokeWidth="2.1">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.2" fill="#FF4D6D" stroke="none" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
        </svg>
      );
    case 'cluster':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="#FFC83D">
          <circle cx="12" cy="7" r="3" />
          <circle cx="7" cy="16" r="2.8" />
          <circle cx="17" cy="16" r="2.8" />
          <circle cx="12" cy="13" r="2.3" fill="#FF4D6D" />
        </svg>
      );
    case 'guided':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#C084FC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20l5-2 9-9-3-3-9 9-2 5Z" fill="#C084FC" fillOpacity="0.25" />
          <path d="M14 6l4 4" />
        </svg>
      );
    case 'bouncing':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#FFC83D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l6-10 6 10 6-9" />
          <circle cx="21" cy="8" r="2" fill="#FF8A00" />
        </svg>
      );
    case 'emp':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#38BDF8" strokeWidth="2.1">
          <circle cx="12" cy="12" r="3" fill="#38BDF8" />
          <circle cx="12" cy="12" r="6.5" strokeDasharray="3 2" />
          <circle cx="12" cy="12" r="10" strokeOpacity="0.55" />
        </svg>
      );
    case 'mines':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#FFC83D" strokeWidth="2.1">
          <circle cx="12" cy="13" r="6" fill="#FFC83D" fillOpacity="0.22" />
          <circle cx="12" cy="13" r="2" fill="#FF4D6D" stroke="none" />
          <path d="M12 4v3M6 7l2 2M18 7l-2 2" strokeLinecap="round" />
        </svg>
      );
    case 'airstrike':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#C084FC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4v10M8 10l4 4 4-4" />
          <ellipse cx="12" cy="19" rx="7" ry="2.5" stroke="#FF4D6D" />
        </svg>
      );
  }
};

export const TurretStyleIcon: React.FC<{ styleId: TurretStyleId; className?: string }> = ({
  styleId,
  className = 'w-5 h-5',
}) => {
  if (styleId === 'angular') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 17l4-8h8l4 8H4Z" fill="currentColor" fillOpacity="0.2" />
        <path d="M16 12h6" strokeLinecap="round" />
      </svg>
    );
  }
  if (styleId === 'brawler') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="8" width="12" height="9" rx="1.5" fill="currentColor" fillOpacity="0.2" />
        <path d="M16 11h6M16 14h6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 17a7 7 0 0 1 12-5v5H5Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M16 13h6" strokeLinecap="round" />
    </svg>
  );
};

export const DecalIcon: React.FC<{ decalId: DecalId; className?: string }> = ({
  decalId,
  className = 'w-5 h-5',
}) => {
  switch (decalId) {
    case 'stripes':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M12 3l2.6 5.4 6 .9-4.3 4.2 1 5.9L12 16.6 6.7 19.4l1-5.9L3.4 9.3l6-.9L12 3Z" />
        </svg>
      );
    case 'skull':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="10" r="6" fill="currentColor" fillOpacity="0.2" />
          <rect x="9" y="15" width="6" height="4" rx="1" />
          <circle cx="10" cy="10" r="1" fill="currentColor" />
          <circle cx="14" cy="10" r="1" fill="currentColor" />
        </svg>
      );
    case 'flame':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M12 3c4 4 6 8 4 12a5 5 0 0 1-8 0c-1-3 0-6 2-8 0 2 1 3 2 3 0-3 0-5 0-7Z" />
        </svg>
      );
    case 'checker':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <rect x="5" y="5" width="7" height="7" />
          <rect x="12" y="12" width="7" height="7" />
          <rect x="12" y="5" width="7" height="7" fillOpacity="0.25" />
          <rect x="5" y="12" width="7" height="7" fillOpacity="0.25" />
        </svg>
      );
    case 'dots':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <circle cx="7" cy="7" r="2.2" />
          <circle cx="17" cy="7" r="2.2" />
          <circle cx="12" cy="12" r="2.2" />
          <circle cx="7" cy="17" r="2.2" />
          <circle cx="17" cy="17" r="2.2" />
        </svg>
      );
  }
};
