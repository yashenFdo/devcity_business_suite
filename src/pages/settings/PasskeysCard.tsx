import React, { useEffect, useState } from 'react';
import { Check, Fingerprint, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { addPasskey, deletePasskey, listPasskeys, passkeysSupported, renamePasskey, type Passkey } from '../../cloud/passkeys';
import { ConfirmModal } from '../../components/ui/Modal';
import { formatDate } from '../../utils/formatters';
import { SettingsCard } from './SettingsPrimitives';

export const PasskeysCard: React.FC = () => {
  const supported = passkeysSupported();
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<Passkey | null>(null);

  useEffect(() => {
    let alive = true;
    listPasskeys()
      .then((list) => alive && setPasskeys(list))
      .catch((e: unknown) => {
        if (!alive) return;
        setPasskeys([]);
        toast.error(e instanceof Error ? e.message : 'Could not load passkeys');
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const add = async () => {
    setAdding(true);
    const r = await addPasskey();
    setAdding(false);
    if (r.ok === true) {
      toast.success('Passkey added. Next time, choose “Sign in with a passkey”.');
      reload();
    } else if (r.error) toast.error(r.error);
  };

  const saveName = async () => {
    if (!editing || !editing.name.trim()) return;
    try {
      await renamePasskey(editing.id, editing.name);
      setEditing(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not rename');
    }
  };

  return (
    <SettingsCard
      title="Passkeys"
      description="Sign in with your fingerprint, face or device PIN instead of a password. Passkeys can't be phished, guessed or reused on other sites."
      actions={
        supported ? (
          <button type="button" className="btn-primary" onClick={add} disabled={adding}>
            {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add a passkey
          </button>
        ) : undefined
      }
    >
      {!supported ? (
        <p className="text-[13px] text-slate-600">This browser doesn't support passkeys. Try a recent version of Edge, Chrome or Safari.</p>
      ) : passkeys === null ? (
        <Loader2 size={18} className="animate-spin text-slate-300" />
      ) : passkeys.length === 0 ? (
        <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-200 p-4">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <Fingerprint size={20} />
          </span>
          <p className="text-[13px] text-slate-600">
            No passkeys yet. Add one on each computer or phone you use. On Windows it uses <b>Windows Hello</b>.
          </p>
        </div>
      ) : (
        <ul className="-mx-2 divide-y divide-slate-100">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-2 py-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Fingerprint size={17} />
              </span>
              <div className="min-w-0 flex-1">
                {editing?.id === p.id ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveName();
                    }}
                  >
                    <input
                      autoFocus
                      className="input h-8"
                      maxLength={120}
                      value={editing.name}
                      onChange={(e) => setEditing({ id: p.id, name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                      aria-label="Passkey name"
                    />
                    <button type="submit" className="btn-icon btn-ghost" aria-label="Save name">
                      <Check size={15} />
                    </button>
                    <button type="button" className="btn-icon btn-ghost" onClick={() => setEditing(null)} aria-label="Cancel">
                      <X size={15} />
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="truncate text-[13px] font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      Added {formatDate(p.createdAt)}
                      {p.lastUsedAt ? ` · last used ${formatDate(p.lastUsedAt, 'dd MMM yyyy, HH:mm')}` : ' · never used'}
                    </p>
                  </>
                )}
              </div>
              {editing?.id !== p.id && (
                <>
                  <button type="button" className="btn-icon btn-ghost" onClick={() => setEditing({ id: p.id, name: p.name })} aria-label={`Rename ${p.name}`}>
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon btn-ghost hover:bg-rose-50 hover:text-rose-600"
                    onClick={() => setRemoving(p)}
                    aria-label={`Remove ${p.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove “${removing?.name ?? 'passkey'}”?`}
        message="You won't be able to sign in with this passkey any more. You can always add it again."
        confirmLabel="Remove passkey"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await deletePasskey(removing.id);
            toast.success('Passkey removed');
            reload();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not remove');
          }
        }}
      />
    </SettingsCard>
  );
};
