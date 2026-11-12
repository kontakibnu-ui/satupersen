"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateTimezone } from "./settings/actions";

const subscribeNever = () => () => {};

const readDeviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
const readDeviceZoneOnServer = () => "";

/**
 * Offers the device's time zone when it differs from the saved one (AUTH-3).
 * The zone is never switched silently: the day, the streak and the 22:00
 * summary all follow it, so the user decides. "Nanti" hides the offer until the
 * page is reloaded; a different device zone shows it again.
 */
export function TimezoneNotice({ savedZone }: { savedZone: string }) {
  const deviceZone = useSyncExternalStore(subscribeNever, readDeviceZone, readDeviceZoneOnServer);
  const [dismissedZone, setDismissedZone] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!deviceZone || deviceZone === savedZone || deviceZone === dismissedZone) {
    return null;
  }

  const change = () => {
    startTransition(async () => {
      const result = await updateTimezone({ timezone: deviceZone });

      setMessage(result.ok ? null : result.message);
    });
  };

  return (
    <Card as="div" role="region" aria-label="Timezone perangkat" className="mt-4 flex flex-col gap-3">
      <p className="text-base text-text">
        Perangkatmu memakai <strong className="font-semibold">{deviceZone}</strong>, sedangkan akunmu{" "}
        <strong className="font-semibold">{savedZone}</strong>. Ganti supaya hari barumu mengikuti perangkat ini?
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={pending} onClick={change}>
          {pending ? "Mengganti…" : "Ganti timezone"}
        </Button>
        <Button variant="link" disabled={pending} onClick={() => setDismissedZone(deviceZone)}>
          Nanti
        </Button>
      </div>
      {message ? (
        <p role="status" className="text-sm text-text-muted">
          {message}
        </p>
      ) : null}
    </Card>
  );
}
