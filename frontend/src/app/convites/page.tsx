'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, Check, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { Stagger, StaggerItem } from '@/components/ui/Motion'
import { hapticSuccess, hapticError } from '@/lib/feedback'
import { trackHappyMoment } from '@/lib/review'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { innovations, type InviteEntry } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { savePendingInvite } from '@/lib/petDraft'
import { useT } from '@/contexts/LocaleContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'
const photoUrl = (p?: string | null) => (p ? (p.startsWith('http') ? p : `${API_URL}${p}`) : null)

const ROLE_LABEL_KEY: Record<string, string> = {
  co_tutor: 'g.inv.role.coTutor',
  sitter: 'g.inv.role.sitter',
  familia: 'g.inv.role.family',
}

function InvitesContent() {
  const t = useT()
  const router = useRouter()
  const search = useSearchParams()
  const { success, error } = useToast()
  const [invites, setInvites] = useState<InviteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  async function load() {
    try { setInvites(await innovations.myInvites()) }
    catch {} finally { setLoading(false) }
  }

  // Sem login: guarda o convite e leva ao cadastro — antes aparecia
  // "Not authenticated" e o convidado desistia.
  const logged = typeof window !== 'undefined' && !!localStorage.getItem('petlife_token')
  useEffect(() => {
    if (logged) return
    const token = search.get('token')
    if (token) {
      savePendingInvite(token)
      router.replace('/auth/register?convite=1')
    } else {
      router.replace('/auth/login')
    }
  }, [logged, search, router])

  useEffect(() => { if (logged) load() }, [logged])

  // Aceitar automaticamente se URL tem ?token=
  useEffect(() => {
    const token = search.get('token')
    if (token && logged) {
      innovations.acceptInvite(token)
        .then(r => {
          success(t('g.inv.accepted', { name: r.pet_name })); trackHappyMoment('cotutor_aceito')
          load()
          router.replace('/convites')
        })
        .catch((e: unknown) => error(e instanceof Error ? e.message : t('g.inv.errAccept')))
    }
  }, [search])

  async function accept(token: string) {
    setProcessing(token)
    try {
      const r = await innovations.acceptInvite(token)
      void hapticSuccess()
      success(t('g.inv.accepted', { name: r.pet_name })); trackHappyMoment('cotutor_aceito')
      await load()
    } catch (e: unknown) {
      void hapticError()
      error(e instanceof Error ? e.message : t('g.misc.errorShort'))
    } finally {
      setProcessing(null)
    }
  }

  async function decline(token: string) {
    setProcessing(token)
    try {
      await innovations.declineInvite(token)
      success(t('g.inv.declined'))
      await load()
    } catch (e: unknown) {
      void hapticError()
      error(e instanceof Error ? e.message : t('g.misc.errorShort'))
    } finally {
      setProcessing(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <PageHeader title={t('g.inv.title')} subtitle={t('g.inv.subtitle')} />

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : invites.length === 0 ? (
          <Card padding="none">
            <EmptyState icon={Users} title={t('g.inv.emptyTitle')} text={t('g.inv.emptyText')} />
          </Card>
        ) : (
          <Stagger as="ul" className="space-y-3">
            {invites.map(inv => {
              const busy = processing === inv.invite_token
              return (
                <StaggerItem as="li" key={inv.id}>
                  <Card padding="lg">
                    <div className="flex items-center gap-4">
                      <PetAvatar
                        pet={{ name: inv.pet_name, species: inv.pet_species, photo_url: photoUrl(inv.pet_photo) }}
                        size={56}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-bold text-[17px] text-surface-900 dark:text-white truncate">{inv.pet_name}</h3>
                        <p className="text-sm text-surface-600 dark:text-surface-400">
                          {t('g.inv.from')} <strong className="text-surface-800 dark:text-surface-200">{inv.inviter_name}</strong>
                        </p>
                        <span className="chip chip-info mt-1.5">{ROLE_LABEL_KEY[inv.role] ? t(ROLE_LABEL_KEY[inv.role]) : inv.role}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button variant="secondary" className="flex-1" leftIcon={X} onClick={() => decline(inv.invite_token)} disabled={busy}>
                        {t('g.inv.decline')}
                      </Button>
                      <Button className="flex-1" leftIcon={Check} onClick={() => accept(inv.invite_token)} loading={busy}>
                        {t('g.inv.accept')}
                      </Button>
                    </div>
                  </Card>
                </StaggerItem>
              )
            })}
          </Stagger>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function InvitesPage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="space-y-3 max-w-2xl mx-auto pt-16"><SkeletonRow /><SkeletonRow /></div></DashboardLayout>}>
      <InvitesContent />
    </Suspense>
  )
}
