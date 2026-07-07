import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { DatabaseBackup, Download, ImagePlus, RotateCcw, Save, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import { useSettings } from '@/context/SettingsContext';
import { api } from '@/services/api';
import { uploadStoreLogo } from '@/services/uploadService';
import { notify } from '@/services/notificationService';
import { logActivity } from '@/services/activityLogService';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, Field } from '@/components/ui/Input';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { formatDateTime } from '@/utils/format';

export default function Settings() {
  const { settings, saveSettings } = useSettings();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [backups, setBackups] = useState(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({ defaultValues: settings });

  useEffect(() => { reset(settings); }, [settings, reset]);

  const loadBackups = async () => {
    try {
      setBackups(await api.listBackups());
    } catch (err) {
      toast.error(`Backup API unavailable: ${err.message}`);
      setBackups([]);
    }
  };
  useEffect(() => { loadBackups(); }, []);

  const onSubmit = async (values) => {
    try {
      await saveSettings({
        ...values,
        taxRate: Number(values.taxRate) || 0,
        lowStockThreshold: Number(values.lowStockThreshold) || 10,
        sessionTimeoutMinutes: Number(values.sessionTimeoutMinutes) || 30,
      });
      await logActivity('SETTINGS_UPDATED', 'Store settings changed', 'settings');
      toast.success('Settings saved.');
    } catch (err) {
      toast.error(err.message || 'Save failed.');
    }
  };

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadStoreLogo(file);
      await saveSettings({ logoUrl: url });
      toast.success('Logo updated.');
    } catch (err) {
      toast.error(err.message || 'Logo upload failed.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const result = await api.createBackup();
      await notify('backup', 'Backup completed', `${result.totalDocs} documents backed up.`);
      toast.success(`Backup completed — ${result.totalDocs} documents.`);
      loadBackups();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const result = await api.restoreBackup(restoreTarget.id);
      toast.success(`Database restored (${result.restored} documents). Reloading…`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRestoring(false);
      setRestoreTarget(null);
    }
  };

  const handleDownload = async (backup) => {
    try {
      const blob = await api.downloadBackup(backup.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.fileName.split('/').pop();
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold"><SettingsIcon className="h-5 w-5 text-gold-dark" /> Store Settings</h1>
        <p className="text-sm text-ink/50">Branding, tax, receipts, security and backups.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Card>
          <CardHeader title="Store profile" />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-4 sm:col-span-2">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Store logo" className="h-16 w-16 rounded-2xl object-cover shadow-card" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink font-serif text-2xl font-bold text-gold">V</div>
              )}
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-xl border border-ink/15 px-4 py-2 text-sm font-medium transition-colors hover:border-gold">
                  <ImagePlus className="h-4 w-4" /> {uploadingLogo ? 'Uploading…' : 'Change logo'}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogo} disabled={uploadingLogo} />
              </label>
            </div>
            <Field label="Store name"><Input {...register('storeName')} /></Field>
            <Field label="Tagline"><Input {...register('tagline')} /></Field>
            <Field label="Phone"><Input {...register('phone')} /></Field>
            <Field label="Email"><Input type="email" {...register('email')} /></Field>
            <Field label="Address" className="sm:col-span-2"><Input {...register('address')} /></Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sales & tax" />
          <CardBody className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Field label="Tax rate %"><Input type="number" min="0" max="100" {...register('taxRate')} /></Field>
            <Field label="Currency code"><Input placeholder="PKR" {...register('currency')} /></Field>
            <Field label="Currency symbol"><Input placeholder="Rs." {...register('currencySymbol')} /></Field>
            <Field label="Low stock threshold"><Input type="number" min="1" {...register('lowStockThreshold')} /></Field>
            <Field label="Opens at"><Input type="time" {...register('businessHours.open')} /></Field>
            <Field label="Closes at"><Input type="time" {...register('businessHours.close')} /></Field>
            <Field label="Language">
              <Select {...register('language')}><option value="en">English</option><option value="ur">اردو (Urdu)</option></Select>
            </Field>
            <Field label="Session timeout (minutes)"><Input type="number" min="5" {...register('sessionTimeoutMinutes')} /></Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Receipt template" />
          <CardBody className="grid grid-cols-1 gap-4">
            <Field label="Thank-you message (receipt footer)"><Input {...register('receiptFooter')} /></Field>
            <Field label="Return policy"><Textarea rows={2} {...register('returnPolicy')} /></Field>
          </CardBody>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="gold" loading={isSubmitting}><Save className="h-4 w-4" /> Save Settings</Button>
        </div>
      </form>

      {/* Backup & restore */}
      <Card>
        <CardHeader
          title="Backup & restore"
          subtitle="Snapshots of every collection, stored in Firebase Storage"
          action={<Button variant="gold" size="sm" onClick={handleBackup} loading={backingUp}><DatabaseBackup className="h-4 w-4" /> Backup Now</Button>}
        />
        <CardBody className="space-y-2 p-4">
          {backups === null ? (
            <p className="py-4 text-center text-sm text-ink/40">Loading backups…</p>
          ) : backups.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink/40">No backups yet — create your first one.</p>
          ) : (
            backups.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/5 p-3">
                <div>
                  <p className="text-sm font-medium">{b.fileName?.split('/').pop()}</p>
                  <p className="text-xs text-ink/45">
                    {b.totalDocs} documents · by {b.createdByEmail} · {b.createdAt?._seconds ? formatDateTime(new Date(b.createdAt._seconds * 1000)) : '—'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDownload(b)}><Download className="h-4 w-4" /> Download</Button>
                  <Button variant="destructive" size="sm" onClick={() => setRestoreTarget(b)}><RotateCcw className="h-4 w-4" /> Restore</Button>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={!!restoreTarget} onClose={() => setRestoreTarget(null)} onConfirm={handleRestore} loading={restoring}
        title="Restore database?" confirmLabel="Restore"
        message="This overwrites current documents with the snapshot contents. Data created after the backup is kept unless it shares an ID with a backed-up document. This cannot be undone."
      />
    </div>
  );
}
