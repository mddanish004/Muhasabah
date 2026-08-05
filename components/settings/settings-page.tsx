"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/hooks/use-api";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUiStore } from "@/stores/uiStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type SettingsData = {
  timezone: string;
  weekStartsOn: number;
  overloadThreshold: number;
};

// ─── Inner form (re-mounted when server data arrives) ─────────────────────────

function SettingsForm({ defaults }: { defaults: SettingsData }) {
  const settings = useSettingsQuery();
  const pushToast = useUiStore((s) => s.pushToast);

  const [timezone, setTimezone] = useState(defaults.timezone);
  const [weekStartsOn, setWeekStartsOn] = useState(String(defaults.weekStartsOn));
  const [overloadThreshold, setOverloadThreshold] = useState(
    String(defaults.overloadThreshold),
  );
  const [saving, setSaving] = useState(false);

  // Passphrase change
  const [currentPassphrase, setCurrentPassphrase] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [changingPassphrase, setChangingPassphrase] = useState(false);

  // Import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importAcknowledged, setImportAcknowledged] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    setSaving(true);
    try {
      await fetchJson("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          timezone,
          weekStartsOn: Number(weekStartsOn),
          overloadThreshold: Number(overloadThreshold),
        }),
      });
      await settings.refetch();
      pushToast({ title: "Settings saved" });
    } catch {
      pushToast({ title: "Failed to save settings", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassphrase() {
    if (!currentPassphrase) {
      pushToast({ title: "Enter your current passphrase", variant: "error" });
      return;
    }
    if (newPassphrase.length < 8) {
      pushToast({
        title: "New passphrase must be at least 8 characters",
        variant: "error",
      });
      return;
    }
    if (newPassphrase !== confirmPassphrase) {
      pushToast({ title: "New passphrases don't match", variant: "error" });
      return;
    }
    setChangingPassphrase(true);
    try {
      await fetchJson("/api/settings/change-passphrase", {
        method: "POST",
        body: JSON.stringify({ currentPassphrase, newPassphrase }),
      });
      pushToast({ title: "Passphrase changed successfully" });
      setCurrentPassphrase("");
      setNewPassphrase("");
      setConfirmPassphrase("");
    } catch {
      pushToast({ title: "Failed to change passphrase", variant: "error" });
    } finally {
      setChangingPassphrase(false);
    }
  }

  async function handleImport() {
    if (!importFile) {
      pushToast({ title: "Select a file to import", variant: "error" });
      return;
    }
    setImporting(true);
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(importFile);
      });
      const json = JSON.parse(text) as unknown;
      await fetchJson("/api/settings/import", {
        method: "POST",
        body: JSON.stringify(json),
      });
      pushToast({ title: "Data imported successfully" });
      setImportFile(null);
      setImportAcknowledged(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      pushToast({ title: "Failed to import data", variant: "error" });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      {/* ── Left column ── */}
      <div className="space-y-6">
        {/* General Settings */}
        <Card className="space-y-5">
          <div>
            <h1 className="text-xl font-semibold">Settings</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Manage timezone, week start, thresholds, and account security.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="timezone"
                className="block text-sm font-medium text-[var(--text-primary)]"
              >
                Timezone
              </label>
              <Input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. America/New_York"
              />
              <p className="text-xs text-[var(--text-tertiary)]">
                Use IANA timezone identifiers, e.g. <code>Europe/London</code>.
              </p>
              <p className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                Changes apply going forward; historical data keeps its original
                day groupings.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="weekStartsOn"
                className="block text-sm font-medium text-[var(--text-primary)]"
              >
                Week starts on
              </label>
              <Select
                id="weekStartsOn"
                value={weekStartsOn}
                onChange={(e) => setWeekStartsOn(e.target.value)}
              >
                <option value="1">Monday</option>
                <option value="0">Sunday</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="overloadThreshold"
                className="block text-sm font-medium text-[var(--text-primary)]"
              >
                Overload threshold
              </label>
              <Input
                id="overloadThreshold"
                type="number"
                min={1}
                max={50}
                value={overloadThreshold}
                onChange={(e) => setOverloadThreshold(e.target.value)}
                placeholder="e.g. 9"
              />
              <p className="text-xs text-[var(--text-tertiary)]">
                Days with more tasks than this value are flagged as overloaded.
              </p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </Card>

        {/* Change Passphrase */}
        <Card className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Change Passphrase</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Update your login passphrase. Minimum 8 characters.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="currentPassphrase"
                className="block text-sm font-medium text-[var(--text-primary)]"
              >
                Current passphrase
              </label>
              <Input
                id="currentPassphrase"
                type="password"
                value={currentPassphrase}
                onChange={(e) => setCurrentPassphrase(e.target.value)}
                placeholder="Enter current passphrase"
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="newPassphrase"
                className="block text-sm font-medium text-[var(--text-primary)]"
              >
                New passphrase
              </label>
              <Input
                id="newPassphrase"
                type="password"
                value={newPassphrase}
                onChange={(e) => setNewPassphrase(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassphrase"
                className="block text-sm font-medium text-[var(--text-primary)]"
              >
                Confirm new passphrase
              </label>
              <Input
                id="confirmPassphrase"
                type="password"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Repeat new passphrase"
                autoComplete="new-password"
              />
            </div>
          </div>

          <Button
            onClick={handleChangePassphrase}
            disabled={changingPassphrase}
            variant="secondary"
          >
            {changingPassphrase ? "Updating…" : "Update Passphrase"}
          </Button>
        </Card>

        {/* Data Import */}
        <Card className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Data Import</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Restore a previously exported JSON backup.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="importFile"
                className="block text-sm font-medium text-[var(--text-primary)]"
              >
                Backup file (.json)
              </label>
              <input
                id="importFile"
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] ?? null);
                  setImportAcknowledged(false);
                }}
                className="block w-full cursor-pointer rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-[var(--bg-surface-3)] file:px-2 file:py-1 file:text-xs file:text-[var(--text-primary)]"
              />
            </div>

            {importFile && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-secondary)]">
                  Selected:{" "}
                  <span className="font-medium">{importFile.name}</span> (
                  {(importFile.size / 1024).toFixed(1)} KB)
                </p>
                <div className="rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--bg-surface-2)] p-3">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={importAcknowledged}
                      onChange={(e) => setImportAcknowledged(e.target.checked)}
                      className="mt-0.5 accent-[var(--danger)]"
                    />
                    <span className="text-xs text-[var(--text-secondary)]">
                      I understand this is a full restore:{" "}
                      <span className="font-medium text-[var(--text-primary)]">
                        all current tasks, categories, tags, and recurring rules
                        will be replaced
                      </span>{" "}
                      by the imported data.
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleImport}
            disabled={!importFile || !importAcknowledged || importing}
            variant="secondary"
          >
            {importing ? "Importing…" : "Import Data"}
          </Button>
        </Card>
      </div>

      {/* ── Right column: Backups ── */}
      <div className="space-y-6">
        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Backups</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Download a full export of your data at any time.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
              <p className="text-sm font-medium">JSON export</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Complete data export including tasks, categories, and settings.
              </p>
              <a href="/api/settings/export" className="mt-3 block">
                <Button variant="secondary" className="w-full">
                  Download JSON
                </Button>
              </a>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                Auto-backup
              </p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                Automatic backups are not yet configured. Export manually on a
                regular schedule.
              </p>
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">About</h2>
          <div className="space-y-1 text-sm text-[var(--text-secondary)]">
            <p>
              <span className="text-[var(--text-primary)]">Muhasabah</span>
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              Personal productivity tracker. All data is stored locally and
              encrypted.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Page shell (handles loading) ─────────────────────────────────────────────

export function SettingsPage() {
  const settings = useSettingsQuery();

  if (settings.isLoading) {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-72" />
          <Skeleton className="h-48" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-56" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const d = settings.data as SettingsData | undefined;
  const defaults: SettingsData = {
    timezone: d?.timezone ?? "UTC",
    weekStartsOn: d?.weekStartsOn ?? 1,
    overloadThreshold: d?.overloadThreshold ?? 9,
  };

  // Key forces SettingsForm to re-mount (and re-initialize state) when
  // server data first arrives, without calling setState inside an effect.
  const formKey = d ? `settings-${d.timezone}-${d.weekStartsOn}-${d.overloadThreshold}` : "default";

  return <SettingsForm key={formKey} defaults={defaults} />;
}
