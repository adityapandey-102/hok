/** One bell entry. `url` is a hok-web path to open on click. */
export interface NotificationResponseDto {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  data: Record<string, string>;
  actorName: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponseDto {
  notifications: NotificationResponseDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface UnreadCountResponseDto {
  count: number;
  /** Unread reminders among them: the bell plays its alert animation while > 0. */
  reminders: number;
}

export interface NotificationPreferenceDto {
  type: string;
  label: string;
  description: string;
  push: boolean;
  inApp: boolean;
}

export interface NotificationPreferencesResponseDto {
  preferences: NotificationPreferenceDto[];
}

export interface PushConfigResponseDto {
  /** False when the server has no VAPID keys: the web hides push controls. */
  enabled: boolean;
  /** VAPID public key (base64url) for PushManager.subscribe; public by design. */
  publicKey: string | null;
}

/** One device that receives push. The endpoint and keys never leave the server. */
export interface PushDeviceDto {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
}

export interface PushDevicesResponseDto {
  devices: PushDeviceDto[];
}

export interface PushTestResponseDto {
  sent: number;
  failed: number;
  removed: number;
}
