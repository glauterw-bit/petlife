'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, Check, Trash2, Loader2, X, GitFork, PawPrint, Heart, Handshake, Dog, Cat, type LucideIcon } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useConfirm } from '@/components/ui/Confirm'
import { hapticSuccess } from '@/lib/feedback'
import { innovations, pets as petsApi, type FamilyTree, type Pet } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

const RELATION_LABEL_KEY: Record<string, string> = {
  parent: 'g.fam.rel.parent',
  offspring: 'g.fam.rel.offspring',
  sibling: 'g.fam.rel.sibling',
  mate: 'g.fam.rel.mate',
  friend: 'g.fam.rel.friend',
}

const RELATION_OPTIONS: Array<{ value: 'sibling' | 'parent' | 'offspring' | 'mate' | 'friend'; labelKey: string; icon: LucideIcon }> = [
  { value: 'sibling', labelKey: 'g.fam.opt.sibling', icon: Users },
  { value: 'parent', labelKey: 'g.fam.opt.parent', icon: GitFork },
  { value: 'offspring', labelKey: 'g.fam.opt.offspring', icon: PawPrint },
  { value: 'mate', labelKey: 'g.fam.opt.mate', icon: Heart },
  { value: 'friend', labelKey: 'g.fam.opt.friend', icon: Handshake },
]

export function FamilyTreeSection({ petId, petName }: { petId: number; petName: string }) {
  const t = useT()
  const { success, error } = useToast()
  const confirm = useConfirm()
  const [tree, setTree] = useState<FamilyTree | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [myPets, setMyPets] = useState<Pet[]>([])
  const [relatedId, setRelatedId] = useState<number | ''>('')
  const [relation, setRelation] = useState<'sibling' | 'parent' | 'offspring' | 'mate' | 'friend'>('sibling')
  const [saving, setSaving] = useState(false)

  async function load() {
    try { setTree(await innovations.familyTree(petId)) }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [petId])

  async function openAdd() {
    setShowAdd(true)
    if (myPets.length === 0) {
      try { setMyPets((await petsApi.list()).filter(p => p.id !== petId)) }
      catch {}
    }
  }

  async function addRelation() {
    if (!relatedId) { error(t('g.fam.errPick')); return }
    setSaving(true)
    try {
      const r = await innovations.addRelation(petId, Number(relatedId), relation)
      success(r.message)
      setShowAdd(false)
      setRelatedId('')
      await load()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('g.misc.errorShort'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmRel(id: number) {
    try {
      await innovations.confirmRelation(id)
      void hapticSuccess()
      success(t('g.fam.confirmed'))
      await load()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('g.misc.errorShort'))
    }
  }

  async function removeRel(id: number) {
    if (!(await confirm({ title: t('g.fam.confirmRemove'), tone: 'danger', confirmLabel: t('ui.confirm.delete') }))) return
    try {
      await innovations.deleteRelation(id)
      success(t('g.fam.removed'))
      await load()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('g.misc.errorShort'))
    }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-surface-500 dark:text-surface-400" /></div>
  if (!tree) return null

  const totalRelations = Object.values(tree.relations).reduce((acc, arr) => acc + (arr?.length ?? 0), 0)
  const hasContent = totalRelations > 0 || tree.pending.length > 0

  return (
    <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/70 dark:border-surface-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitFork className="w-5 h-5 text-primary-700 dark:text-primary-300" aria-hidden />
          <h3 className="font-bold text-surface-900 dark:text-white">{t('g.fam.title')}</h3>
        </div>
        <button
          onClick={openAdd}
          className="pressable flex items-center gap-1 min-h-[44px] text-sm font-semibold bg-primary-50 dark:bg-primary-500/15 text-primary-800 dark:text-primary-200 hover:bg-primary-100 px-3.5 rounded-xl"
        >
          <Plus className="w-3.5 h-3.5" /> {t('common.add')}
        </button>
      </div>

      {!hasContent && (
        <p className="text-sm text-surface-600 dark:text-surface-400 text-center py-4">
          {t('g.fam.empty', { name: petName })}
        </p>
      )}

      {tree.pending.length > 0 && (
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300 font-semibold mb-2">{t('g.fam.pending')}</p>
          <div className="space-y-1.5">
            {tree.pending.map(p => (
              <div key={p.relation_id} className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-2">
                <PetThumb pet={p} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{p.pet_name}</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">{RELATION_LABEL_KEY[p.relation || ''] ? t(RELATION_LABEL_KEY[p.relation || '']) : p.relation} · {p.owner_name}</p>
                </div>
                {p.is_inbound ? (
                  <button onClick={() => confirmRel(p.relation_id)} aria-label={t('g.fam.confirmAria')} className="pressable w-11 h-11 flex items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
                    <Check className="w-4 h-4" aria-hidden />
                  </button>
                ) : (
                  <button onClick={() => removeRel(p.relation_id)} aria-label={t('common.cancel')} className="pressable w-11 h-11 flex items-center justify-center rounded-xl text-surface-500 dark:text-surface-400 hover:text-red-600 dark:hover:text-red-300">
                    <Trash2 className="w-4 h-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.entries(tree.relations).map(([rel, members]) => {
        if (!members || members.length === 0) return null
        return (
          <div key={rel} className="mb-3">
            <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400 font-semibold mb-1.5">
              {RELATION_LABEL_KEY[rel] ? t(RELATION_LABEL_KEY[rel]) : rel} ({members.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {members.map(m => (
                <div key={m.relation_id} className="flex items-center gap-2 bg-surface-50 dark:bg-surface-800 rounded-xl pl-2 py-1 pr-0">
                  <PetThumb pet={m} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{m.pet_name}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 truncate">{m.breed ?? '—'}</p>
                  </div>
                  <button onClick={() => removeRel(m.relation_id)} aria-label={t('g.fam.removeAria')} className="pressable w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-surface-500 hover:text-red-600 dark:text-surface-400 dark:hover:text-red-300">
                    <X className="w-4 h-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Add modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={t('g.fam.addTitle')}>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2 text-surface-700 dark:text-surface-200">{t('g.fam.whichPet')}</p>
                {myPets.length === 0 ? (
                  <p className="text-sm text-surface-600 dark:text-surface-400">{t('g.fam.onlyOne')}</p>
                ) : (
                  <select
                    value={relatedId}
                    onChange={e => setRelatedId(Number(e.target.value))}
                    aria-label={t('g.fam.whichPet')}
                    className="w-full px-3 min-h-[44px] bg-white border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">{t('g.fam.select')}</option>
                    {myPets.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.breed?.name ?? t('g.misc.srd')})</option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
                  {t('g.fam.otherOwnerHint')}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2 text-surface-700 dark:text-surface-200">{t('g.fam.whichRelation')}</p>
                <div className="space-y-1.5">
                  {RELATION_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setRelation(o.value)}
                      aria-pressed={relation === o.value}
                      className={`pressable w-full flex items-center gap-3 px-3 min-h-[48px] rounded-xl border text-left ${
                        relation === o.value
                          ? 'border-primary-600 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-500/15 dark:text-primary-200'
                          : 'border-surface-200 text-surface-800 dark:border-surface-700 dark:text-surface-200'
                      }`}
                    >
                      <o.icon className="w-5 h-5 shrink-0" aria-hidden />
                      <span className="text-sm font-medium">{t(o.labelKey)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={addRelation}
                disabled={saving || !relatedId}
                className="pressable w-full flex items-center justify-center gap-2 min-h-[48px] bg-primary-700 hover:bg-primary-800 text-white dark:bg-primary-500 dark:text-surface-950 font-semibold rounded-xl disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                {saving ? t('g.misc.saving') : t('common.add')}
              </button>
            </div>
      </Modal>
    </div>
  )
}

function PetThumb({ pet }: { pet: { pet_photo: string | null; pet_species: string } }) {
  return (
    <div className="w-9 h-9 rounded-xl overflow-hidden bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center shrink-0">
      {pet.pet_photo ? (
        <img src={`${API_URL}${pet.pet_photo}`} alt="" className="w-full h-full object-cover" />
      ) : (
        pet.pet_species === 'cat' ? <Cat className="w-5 h-5 text-primary-700 dark:text-primary-300" aria-hidden /> : <Dog className="w-5 h-5 text-primary-700 dark:text-primary-300" aria-hidden />
      )}
    </div>
  )
}
