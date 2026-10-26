'use client'

/**
 * Contatos de emergência guardados SÓ no aparelho (localStorage).
 *
 * Nada vai para o servidor e nada é coletado: o tutor digita o próprio
 * veterinário, um hospital 24h e um contato reserva, e liga com um toque
 * (tel:). O endereço, quando existe, abre no app de mapas. Não listamos
 * hospitais "perto": isso exigiria localização e uma base que não temos.
 *
 * Os contatos são da conta (chave por usuário), não de um pet: o mesmo
 * veterinário costuma atender todos os pets da casa.
 */
import { useEffect, useId, useState } from 'react'
import { Phone, MapPin, Stethoscope, Hospital, UserRound, Pencil, ShieldCheck, Plus, type LucideIcon } from 'lucide-react'
import { useT } from '@/contexts/LocaleContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/ToastContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { haptic } from '@/lib/feedback'
import { cn } from '@/lib/utils'

type SlotId = 'vet' | 'hospital' | 'backup'

interface Contact {
  name: string
  phone: string
  address?: string
}

type Contacts = Partial<Record<SlotId, Contact>>

const SLOTS: { id: SlotId; icon: LucideIcon; hasAddress: boolean }[] = [
  { id: 'vet', icon: Stethoscope, hasAddress: true },
  { id: 'hospital', icon: Hospital, hasAddress: true },
  { id: 'backup', icon: UserRound, hasAddress: false },
]

const storageKey = (userId: number | string) => `petlife_emergency_v1_${userId}`

function clean(c: Contact | undefined): Contact | undefined {
  if (!c) return undefined
  const name = (c.name || '').trim().slice(0, 80)
  const phone = (c.phone || '').trim().slice(0, 30)
  const address = (c.address || '').trim().slice(0, 200)
  if (!name && !phone) return undefined
  return { name, phone, ...(address ? { address } : {}) }
}

function load(userId: number | string): Contacts {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Contacts
    const out: Contacts = {}
    for (const s of SLOTS) {
      const c = clean(parsed?.[s.id])
      if (c) out[s.id] = c
    }
    return out
  } catch {
    return {}
  }
}

/** Só dígitos e "+" no link tel: (o iOS aceita a máscara, mas alguns Androids não). */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

function mapsHref(address: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`
}

const INPUT =
  'w-full px-4 min-h-[48px] bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl text-[15px] text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500'
const LABEL = 'block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5'

export function EmergencyContactsCard() {
  const t = useT()
  const { user } = useAuth()
  const { success, error } = useToast()
  const uid = user?.id ?? null
  const [contacts, setContacts] = useState<Contacts>({})
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Contacts>({})
  const baseId = useId()

  useEffect(() => {
    if (uid == null) return
    setContacts(load(uid))
  }, [uid])

  if (uid == null) return null

  const filled = SLOTS.filter(s => contacts[s.id])

  function startEdit() {
    haptic('tap')
    setDraft(contacts)
    setOpen(true)
  }

  function setField(slot: SlotId, field: keyof Contact, value: string) {
    setDraft(d => ({ ...d, [slot]: { name: '', phone: '', ...d[slot], [field]: value } }))
  }

  function save() {
    const next: Contacts = {}
    for (const s of SLOTS) {
      const c = clean(draft[s.id])
      if (c) next[s.id] = s.hasAddress ? c : { name: c.name, phone: c.phone }
    }
    try {
      localStorage.setItem(storageKey(uid!), JSON.stringify(next))
      setContacts(next)
      setOpen(false)
      haptic('saved')
      success(t('pet3.em.saved'))
    } catch {
      haptic('error')
      error(t('pet3.em.saveError'))
    }
  }

  return (
    <Card as="section" aria-labelledby={`${baseId}-title`} padding="none" className="overflow-hidden">
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300 flex items-center justify-center">
          <Phone className="w-5 h-5" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <h3 id={`${baseId}-title`} className="font-display font-bold text-surface-900 dark:text-white">
            {t('pet3.em.title')}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-surface-600 dark:text-surface-300">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden />
            {t('pet3.em.local')}
          </p>
        </div>
        {filled.length > 0 && (
          <button
            type="button"
            onClick={startEdit}
            aria-label={t('pet3.em.editAria')}
            className="pressable -mr-2 -mt-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3 rounded-full text-sm font-semibold text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-500/10"
          >
            <Pencil className="w-4 h-4" aria-hidden />
            <span>{t('pet3.em.edit')}</span>
          </button>
        )}
      </div>

      {filled.length === 0 ? (
        <div className="px-4 pb-4">
          <p className="text-[14px] text-surface-700 dark:text-surface-300 leading-relaxed">{t('pet3.em.emptyBody')}</p>
          <Button className="mt-3" fullWidth variant="secondary" leftIcon={Plus} onClick={startEdit}>
            {t('pet3.em.add')}
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-surface-100 dark:divide-surface-800 border-t border-surface-100 dark:border-surface-800">
          {SLOTS.map(s => {
            const c = contacts[s.id]
            const Icon = s.icon
            const who = c?.name || t(`pet3.em.${s.id}`)
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Icon className="w-5 h-5 shrink-0 text-surface-500 dark:text-surface-400" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-surface-600 dark:text-surface-300">{t(`pet3.em.${s.id}`)}</p>
                  {c ? (
                    <>
                      <p className="font-semibold text-[15px] text-surface-900 dark:text-white truncate">{c.name || c.phone}</p>
                      {c.name && c.phone && (
                        <p className="text-[13px] text-surface-600 dark:text-surface-300 tabular-nums truncate">{c.phone}</p>
                      )}
                      {c.address && (
                        <a
                          href={mapsHref(c.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t('pet3.em.mapAria', { name: who })}
                          className="inline-flex items-center gap-1 min-h-[44px] -my-2 text-[13px] font-semibold text-primary-700 dark:text-primary-300"
                        >
                          <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden />
                          <span className="truncate">{t('pet3.em.map')}</span>
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-[14px] text-surface-500 dark:text-surface-400">{t('pet3.em.notSet')}</p>
                  )}
                </div>
                {c?.phone && (
                  <a
                    href={telHref(c.phone)}
                    aria-label={t('pet3.em.callAria', { name: who })}
                    onClick={() => haptic('tap')}
                    className="pressable shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-4 rounded-full bg-primary-700 text-white dark:bg-primary-500 dark:text-surface-950 text-sm font-semibold"
                  >
                    <Phone className="w-4 h-4" aria-hidden />
                    <span>{t('pet3.em.call')}</span>
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('pet3.em.title')}
        description={t('pet3.em.sheetDesc')}
        size="tall"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save}>{t('common.save')}</Button>
          </div>
        }
      >
        <form
          className="space-y-6 pb-2"
          onSubmit={e => {
            e.preventDefault()
            save()
          }}
        >
          {SLOTS.map(s => {
            const d = draft[s.id]
            const fid = `${baseId}-${s.id}`
            return (
              <fieldset key={s.id} className="space-y-3">
                <legend className="flex items-center gap-2 mb-1 font-display font-bold text-surface-900 dark:text-white">
                  <s.icon className="w-4 h-4 text-surface-500 dark:text-surface-400" aria-hidden />
                  {t(`pet3.em.${s.id}`)}
                </legend>
                <div>
                  <label htmlFor={`${fid}-name`} className={LABEL}>{t('pet3.em.name')}</label>
                  <input
                    id={`${fid}-name`}
                    type="text"
                    autoComplete={s.id === 'backup' ? 'name' : 'organization'}
                    autoCapitalize="words"
                    maxLength={80}
                    value={d?.name ?? ''}
                    onChange={e => setField(s.id, 'name', e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor={`${fid}-phone`} className={LABEL}>{t('pet3.em.phone')}</label>
                  <input
                    id={`${fid}-phone`}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={30}
                    placeholder={t('pet3.em.phonePh')}
                    value={d?.phone ?? ''}
                    onChange={e => setField(s.id, 'phone', e.target.value)}
                    className={cn(INPUT, 'tabular-nums')}
                  />
                </div>
                {s.hasAddress && (
                  <div>
                    <label htmlFor={`${fid}-addr`} className={LABEL}>{t('pet3.em.address')}</label>
                    <input
                      id={`${fid}-addr`}
                      type="text"
                      autoComplete="street-address"
                      maxLength={200}
                      value={d?.address ?? ''}
                      onChange={e => setField(s.id, 'address', e.target.value)}
                      className={INPUT}
                    />
                  </div>
                )}
              </fieldset>
            )
          })}
          {/* Enter no teclado envia o formulário */}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>
            {t('common.save')}
          </button>
        </form>
      </Sheet>
    </Card>
  )
}
