'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, Check, Trash2, Loader2, X, GitFork } from 'lucide-react'
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

const RELATION_OPTIONS: Array<{ value: 'sibling' | 'parent' | 'offspring' | 'mate' | 'friend'; labelKey: string; emoji: string }> = [
  { value: 'sibling', labelKey: 'g.fam.opt.sibling', emoji: '👯' },
  { value: 'parent', labelKey: 'g.fam.opt.parent', emoji: '👨‍👩‍👧' },
  { value: 'offspring', labelKey: 'g.fam.opt.offspring', emoji: '🐾' },
  { value: 'mate', labelKey: 'g.fam.opt.mate', emoji: '💕' },
  { value: 'friend', labelKey: 'g.fam.opt.friend', emoji: '🤝' },
]

export function FamilyTreeSection({ petId, petName }: { petId: number; petName: string }) {
  const t = useT()
  const { success, error } = useToast()
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
      success(t('g.fam.confirmed'))
      await load()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('g.misc.errorShort'))
    }
  }

  async function removeRel(id: number) {
    if (!confirm(t('g.fam.confirmRemove'))) return
    try {
      await innovations.deleteRelation(id)
      success(t('g.fam.removed'))
      await load()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('g.misc.errorShort'))
    }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-surface-400" /></div>
  if (!tree) return null

  const totalRelations = Object.values(tree.relations).reduce((acc, arr) => acc + (arr?.length ?? 0), 0)
  const hasContent = totalRelations > 0 || tree.pending.length > 0

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitFork className="w-5 h-5 text-pink-500" />
          <h3 className="font-bold text-surface-900 dark:text-white">{t('g.fam.title')}</h3>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1 text-xs font-semibold bg-pink-50 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 hover:bg-pink-100 px-3 py-1.5 rounded-full"
        >
          <Plus className="w-3.5 h-3.5" /> {t('common.add')}
        </button>
      </div>

      {!hasContent && (
        <p className="text-sm text-surface-400 text-center py-4">
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
                  <button onClick={() => confirmRel(p.relation_id)} aria-label={t('g.fam.confirmAria')} className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button onClick={() => removeRel(p.relation_id)} aria-label={t('common.cancel')} className="p-1.5 rounded-lg text-surface-500 dark:text-surface-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {members.map(m => (
                <div key={m.relation_id} className="flex items-center gap-2 bg-surface-50 dark:bg-surface-700/40 rounded-xl p-2 group relative">
                  <PetThumb pet={m} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{m.pet_name}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 truncate">{m.breed ?? '—'}</p>
                  </div>
                  <button onClick={() => removeRel(m.relation_id)} aria-label={t('g.fam.removeAria')} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded-lg bg-white/90 dark:bg-surface-800/90 text-red-500 transition">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 dark:border-surface-700">
              <h2 className="font-bold text-surface-900 dark:text-white">{t('g.fam.addTitle')}</h2>
              <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2 text-surface-700 dark:text-surface-200">{t('g.fam.whichPet')}</p>
                {myPets.length === 0 ? (
                  <p className="text-sm text-surface-400">{t('g.fam.onlyOne')}</p>
                ) : (
                  <select
                    value={relatedId}
                    onChange={e => setRelatedId(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="">{t('g.fam.select')}</option>
                    {myPets.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.species === 'dog' ? '🐕' : '🐈'} {p.breed?.name ?? t('g.misc.srd')})</option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-surface-400 mt-1">
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
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left ${
                        relation === o.value
                          ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'
                          : 'border-surface-200 dark:border-surface-700'
                      }`}
                    >
                      <span className="text-xl">{o.emoji}</span>
                      <span className="text-sm font-medium">{t(o.labelKey)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={addRelation}
                disabled={saving || !relatedId}
                className="w-full flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-semibold py-3 rounded-xl disabled:opacity-60 shadow-md shadow-pink-500/30"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                {saving ? t('g.misc.saving') : t('common.add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PetThumb({ pet }: { pet: { pet_photo: string | null; pet_species: string } }) {
  return (
    <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-br from-primary-50 to-pink-50 dark:from-primary-900/30 dark:to-pink-900/30 flex items-center justify-center shrink-0">
      {pet.pet_photo ? (
        <img src={`${API_URL}${pet.pet_photo}`} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-lg">{pet.pet_species === 'dog' ? '🐕' : '🐈'}</span>
      )}
    </div>
  )
}
