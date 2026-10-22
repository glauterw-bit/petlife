/** Cliente da API do PetLife Clínica (CRM) e das rotas do tutor ligadas à clínica. */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

export type ApptStatus = 'agendado' | 'confirmado' | 'chegou' | 'em_atendimento' | 'pronto' | 'concluido' | 'faltou' | 'cancelado'
export type PayMethod = 'pix' | 'dinheiro' | 'debito' | 'credito' | 'boleto' | 'fiado'

export interface CrmError extends Error { status?: number; data?: { code?: string; message?: string; conflicts?: Appt[] } }
export const isCrmError = (e: unknown): e is CrmError => e instanceof Error

async function request<T>(base: string, method: string, path: string, body?: unknown): Promise<T> {
  let token: string | null = null
  if (typeof window !== 'undefined') {
    try { token = localStorage.getItem('petlife_token') } catch { token = null }
  }
  let res: Response
  try {
    res = await fetch(`${API_URL}${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    })
  } catch {
    const e = new Error('Sem conexão com o servidor. Confira a internet e tente de novo.') as CrmError
    e.status = 0
    throw e
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`
    let data: CrmError['data'] | undefined
    try {
      const d = await res.json()
      const det = d?.detail
      if (Array.isArray(det)) msg = 'Confira os dados informados.'
      else if (det && typeof det === 'object') { data = det; msg = det.message || msg }
      else if (typeof det === 'string') msg = det
    } catch {}
    const e = new Error(msg) as CrmError
    e.status = res.status
    e.data = data
    throw e
  }
  const t = await res.text()
  return (t ? JSON.parse(t) : {}) as T
}
const req = <T,>(method: string, path: string, body?: unknown) => request<T>('/crm', method, path, body)
const get = <T,>(p: string) => req<T>('GET', p)
const post = <T,>(p: string, b?: unknown) => req<T>('POST', p, b ?? {})
const put = <T,>(p: string, b: unknown) => req<T>('PUT', p, b)
const patch = <T,>(p: string, b: unknown) => req<T>('PATCH', p, b)
const del = <T,>(p: string) => req<T>('DELETE', p)
const range = (start: Date, end: Date) => `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`

export type Role = 'admin' | 'vet' | 'recepcao' | 'banho_tosa'
export interface CrmMe { user: { id: number; name: string; email: string; role: Role; crmv: string | null }; clinic: { id: number; name: string; cnpj: string | null; phone: string | null; email: string | null; address: string | null; city: string | null; state: string | null; plan: string; business_type: string } }
export interface Client { id: number; name: string; phone: string | null; email: string | null; document: string | null; address: string | null; notes: string | null; petlife_linked: boolean; created_at: string; patients?: Array<{ id: number; name: string; species: string }> }
export interface Patient { id: number; client_id: number; name: string; species: string; breed: string | null; sex: string | null; birth_date: string | null; weight_kg: number | null; neutered: boolean | null; microchip: string | null; color: string | null; notes: string | null; deceased: boolean; petlife_linked: boolean; created_at: string; allergies: string | null; size: string | null; coat: string | null; temperament: string | null; grooming_notes: string | null; consent_active: boolean; invite_pending: boolean }
export interface Item { id: number; kind: 'service' | 'product'; category: string | null; name: string; sku: string | null; price: number; cost: number | null; stock_qty: number | null; min_stock: number | null; unit: string | null; duration_min: number | null; active: boolean; low_stock: boolean }
export interface Appt { id: number; client_id: number; patient_id: number | null; item_id: number | null; staff_user_id: number | null; type: string; status: string; starts_at: string; ends_at: string | null; price: number | null; notes: string | null; client_name: string | null; client_phone: string | null; patient_name: string | null; patient_species: string | null; staff_name: string | null; item_name: string | null; is_fit_in: boolean; duration_min: number; confirmed_at: string | null; checked_in_at: string | null; started_at: string | null; ready_at: string | null; finished_at: string | null; confirm_sent_at: string | null; ready_notified_at: string | null }
export interface ApptInput { client_id: number; patient_id?: number | null; item_id?: number | null; staff_user_id?: number | null; type?: string; status?: ApptStatus; starts_at: string; ends_at?: string | null; price?: number | null; notes?: string | null; is_fit_in?: boolean; allow_conflict?: boolean }
export type ApptPatch = Partial<Omit<ApptInput, 'client_id'>> & { mark_confirm_sent?: boolean; mark_ready_notified?: boolean }
export interface WaitItem { id: number; client_id: number; client_name: string; client_phone: string | null; patient_id: number | null; patient_name: string | null; item_id: number | null; item_name: string | null; staff_user_id: number | null; staff_name: string | null; period: 'manha' | 'tarde' | 'qualquer'; days: string | null; notes: string | null; status: 'aguardando' | 'agendado' | 'cancelado'; appointment_id: number | null; created_at: string }
export interface Addendum { id: number; body: string; staff_name: string | null; created_at: string }
export interface RecordEntry { id: number; patient_id: number; kind: string; title: string; body: string | null; weight_kg: number | null; temperature_c: number | null; vaccine_name: string | null; vaccine_lot: string | null; next_due: string | null; sent_to_app: boolean; staff_name: string | null; created_at: string; appointment_id: number | null; staff_user_id: number | null; subjective: string | null; objective: string | null; assessment: string | null; plan: string | null; mucosa: string | null; hydration: string | null; heart_rate: number | null; resp_rate: number | null; body_score: number | null; performed_at: string; locked: boolean; voided_at: string | null; void_reason: string | null; voided_by_name: string | null; updated_at: string | null; reminded_at: string | null; addenda: Addendum[] }
export interface RecordInput { kind: string; title: string; body?: string | null; subjective?: string | null; objective?: string | null; assessment?: string | null; plan?: string | null; weight_kg?: number | null; temperature_c?: number | null; heart_rate?: number | null; resp_rate?: number | null; mucosa?: string | null; hydration?: string | null; body_score?: number | null; vaccine_name?: string | null; vaccine_lot?: string | null; next_due?: string | null; performed_at?: string | null; appointment_id?: number | null }
export interface RecordTemplate { id: number; kind: string; name: string; title: string | null; body: string | null; subjective: string | null; objective: string | null; assessment: string | null; plan: string | null }
export interface SaleItemRow { id: number; item_id: number | null; description: string; qty: number; unit_price: number; total: number; staff_user_id: number | null; staff_name: string | null }
export interface Sale { id: number; client_id: number | null; patient_id: number | null; appointment_id: number | null; subtotal: number; discount: number; total: number; payment_method: string | null; status: string; due_date: string | null; paid_at: string | null; notes: string | null; created_at: string; client_name: string | null; client_phone?: string | null; cash_session_id: number | null; patient_name: string | null; user_name: string | null; warnings?: string[]; items?: SaleItemRow[] }
export interface SaleInput { client_id?: number | null; patient_id?: number | null; appointment_id?: number | null; items: Array<{ item_id?: number; description?: string; qty: number; unit_price?: number; staff_user_id?: number | null }>; discount: number; payment_method: string; status: 'paga' | 'aberta'; due_date?: string | null; notes?: string; allow_without_cash?: boolean }
export interface ClientFull extends Client { patients: Patient[]; appointments: Appt[]; sales: Sale[]; open_balance: number; total_spent: number }
export interface ClientRow extends Client { patients: Array<{ id: number; name: string; species: string }>; open_balance: number; last_visit: string | null }
export interface PatientFull extends Patient { client: Client | null; records: RecordEntry[]; appointments: Appt[]; app_vaccines: Array<{ name: string; date_given: string; next_due: string | null; veterinarian: string | null }>; weights: Array<{ date: string; kg: number }> }
export interface Reminder { record_id: number; kind: string; what: string; next_due: string; overdue: boolean; patient_id: number; patient_name: string; client_id: number; client_name: string; client_phone: string | null; in_app: boolean; days_left: number; reminded_at: string | null; consent_active: boolean }
export interface Member { id: number; user_id: number; name: string; email: string; role: Role; crmv: string | null; is_me: boolean }
export interface AppPet { pet_id: number; pet_name: string; species: string; owner_name: string; owner_email: string; owner_phone: string | null; granted_at: string; imported: boolean }
export interface Invite { id: number; patient_id: number; patient_name: string; client_name: string; client_phone: string | null; created_at: string; expires_at: string; used_at: string | null; status: 'pendente' | 'aceito' | 'expirado' }
export interface StockMove { id: number; qty: number; reason: string; note: string | null; user_name: string | null; at: string }
export interface CashMove { id: number; kind: 'sangria' | 'reforco'; amount: number; note: string | null; user_name: string | null; created_at: string }
export interface CashSession { id: number; status: 'aberto' | 'fechado'; opened_at: string; opened_by_name: string | null; opening_amount: number; closed_at: string | null; closed_by_name: string | null; sales_count: number; totals_by_method: Partial<Record<PayMethod, number>>; sangrias: number; reforcos: number; expected: Partial<Record<PayMethod, number>>; counted: Partial<Record<PayMethod, number>> | null; difference: Partial<Record<PayMethod, number>> | null; difference_total: number | null; moves: CashMove[]; notes: string | null }
export interface Finance { month: string; revenue: number; expenses: number; profit: number; sales_count: number; avg_ticket: number; receivable_open: number; payable_open: number; by_day: Array<{ day: string; total: number }>; by_method: Array<{ method: string; total: number; count: number }>; by_category: Array<{ category: string; total: number }>; expenses_by_category: Array<{ category: string; total: number }> }
export interface Expense { id: number; description: string; category: string | null; amount: number; due_date: string | null; paid_at: string | null; created_at: string }
export interface CashFlow { days: Array<{ day: string; in: number; out: number }>; receivable_overdue: number; payable_overdue: number; no_due_in: number; no_due_out: number }
export interface ReportSummary { revenue: number; sales_count: number; avg_ticket: number; by_item: Array<{ name: string; kind: string; qty: number; total: number }>; by_category: Array<{ category: string; total: number }>; by_staff: Array<{ user_id: number | null; name: string; total: number; count: number }>; by_method: Array<{ method: string; total: number; count: number }>; top_products: Array<{ name: string; qty: number; total: number }>; appointments: { total: number; done: number; no_show: number; cancelled: number; no_show_rate: number }; lapsed_clients: { count: number; items: Array<{ client_id: number; name: string; phone: string | null; last_visit: string }> } }
export interface CommissionRate { id: number; user_id: number; user_name: string; category: string | null; pct: number }
export interface CommissionRow { user_id: number; name: string; items_count: number; services_total: number; products_total: number; base_total: number; commission: number }
export interface Dashboard { today: Appt[]; today_by_status: Record<string, number>; revenue_today: number; revenue_month: number; new_clients_month: number; total_clients: number; total_patients: number; low_stock: Item[]; reminders_due: number; app_patients_pending: number; revenue_by_day: Array<{ day: string; total: number }>; in_clinic: number }
export interface ClinicInviteInfo { clinic: { id: number; name: string; city: string | null; state: string | null }; patient: { name: string; species: string }; expires_at: string; shares: string[]; pets: Array<{ id: number; name: string; species: string; already_shared: boolean }>; suggested_pet_id: number | null; past_vaccines_count: number }
export interface ClinicAccess { pet_id: number; pet_name: string; clinic_id: number; clinic_name: string; clinic_city: string | null; granted_at: string }

export const crm = {
  me: () => get<CrmMe>('/me'),
  updateClinic: (d: Partial<CrmMe['clinic']>) => put<{ ok: boolean }>('/clinic', d),
  dashboard: () => get<Dashboard>('/dashboard'),
  team: () => get<Member[]>('/team'),
  addMember: (d: { name: string; email: string; password?: string; role: Role; crmv?: string }) => post<{ ok: boolean; temporary_password: string | null }>('/team', d),
  patchMember: (id: number, d: { role?: Role; crmv?: string }) => patch<{ ok: boolean }>(`/team/${id}`, d),
  removeMember: (id: number) => del<{ ok: boolean }>(`/team/${id}`),

  clients: (q = '') => get<Client[]>(`/clients?q=${encodeURIComponent(q)}`),
  clientsPage: (q = '', offset = 0, limit = 50) => get<{ items: ClientRow[]; total: number }>(`/clients/page?q=${encodeURIComponent(q)}&offset=${offset}&limit=${limit}`),
  client: (id: number) => get<ClientFull>(`/clients/${id}`),
  createClient: (d: Partial<Client>) => post<Client>('/clients', d),
  updateClient: (id: number, d: Partial<Client>) => put<Client>(`/clients/${id}`, d),
  deleteClient: (id: number) => del<{ ok: boolean }>(`/clients/${id}`),

  patient: (id: number) => get<PatientFull>(`/patients/${id}`),
  createPatient: (d: Partial<Patient>) => post<Patient>('/patients', d),
  updatePatient: (id: number, d: Partial<Patient>) => put<Patient>(`/patients/${id}`, d),
  invitePatient: (pid: number) => post<{ code: string; path: string; expires_at: string }>(`/patients/${pid}/invite`),
  invites: () => get<Invite[]>('/invites'),

  addRecord: (pid: number, d: RecordInput) => post<RecordEntry & { sent_to_app: boolean }>(`/patients/${pid}/records`, d),
  updateRecord: (id: number, d: Partial<RecordInput>) => put<RecordEntry>(`/records/${id}`, d),
  voidRecord: (id: number, reason: string) => post<RecordEntry>(`/records/${id}/void`, { reason }),
  addAddendum: (id: number, body: string) => post<RecordEntry>(`/records/${id}/addenda`, { body }),
  deleteRecord: (id: number) => del<{ ok: boolean }>(`/records/${id}`),
  markReminded: (recordId: number) => post<{ ok: boolean }>(`/records/${recordId}/reminded`),
  recordTemplates: (kind = '') => get<RecordTemplate[]>(`/record-templates?kind=${encodeURIComponent(kind)}`),
  createRecordTemplate: (d: Omit<RecordTemplate, 'id'>) => post<RecordTemplate>('/record-templates', d),
  updateRecordTemplate: (id: number, d: Partial<Omit<RecordTemplate, 'id'>>) => put<RecordTemplate>(`/record-templates/${id}`, d),
  deleteRecordTemplate: (id: number) => del<{ ok: boolean }>(`/record-templates/${id}`),

  appPatients: () => get<AppPet[]>('/app-patients'),
  importAppPatient: (petId: number) => post<{ patient_id: number; client_id: number; already: boolean }>(`/app-patients/${petId}/import`),

  items: (kind = '', includeInactive = false) => get<Item[]>(`/items?kind=${kind}&include_inactive=${includeInactive}`),
  createItem: (d: Partial<Item>) => post<Item>('/items', d),
  updateItem: (id: number, d: Partial<Item>) => put<Item>(`/items/${id}`, d),
  deleteItem: (id: number) => del<{ ok: boolean; deactivated: boolean }>(`/items/${id}`),
  moveStock: (id: number, d: { qty: number; reason: string; note?: string }) => post<Item>(`/items/${id}/stock`, d),
  itemMoves: (id: number) => get<StockMove[]>(`/items/${id}/moves`),

  appointments: (start: Date, end: Date, staffUserId?: number | null) =>
    get<Appt[]>(`/appointments?${range(start, end)}${staffUserId ? `&staff_user_id=${staffUserId}` : ''}`),
  appointment: (id: number) => get<Appt>(`/appointments/${id}`),
  createAppt: (d: ApptInput) => post<Appt>('/appointments', d),
  patchAppt: (id: number, d: ApptPatch) => patch<Appt>(`/appointments/${id}`, d),
  deleteAppt: (id: number) => del<{ ok: boolean }>(`/appointments/${id}`),

  waitlist: (status: 'aguardando' | 'agendado' | 'cancelado' = 'aguardando') => get<WaitItem[]>(`/waitlist?status=${status}`),
  createWait: (d: { client_id: number; patient_id?: number | null; item_id?: number | null; staff_user_id?: number | null; period?: 'manha' | 'tarde' | 'qualquer'; days?: string | null; notes?: string | null }) => post<WaitItem>('/waitlist', d),
  patchWait: (id: number, d: Partial<{ status: WaitItem['status']; period: WaitItem['period']; days: string | null; notes: string | null; appointment_id: number | null }>) => patch<WaitItem>(`/waitlist/${id}`, d),
  deleteWait: (id: number) => del<{ ok: boolean }>(`/waitlist/${id}`),

  sales: (start: Date, end: Date, status = '') => get<Sale[]>(`/sales?${range(start, end)}&status=${status}`),
  sale: (id: number) => get<Sale>(`/sales/${id}`),
  createSale: (d: SaleInput) => post<Sale>('/sales', d),
  paySale: (id: number, method: string, allowWithoutCash?: boolean) =>
    post<Sale>(`/sales/${id}/pay`, { payment_method: method, ...(allowWithoutCash ? { allow_without_cash: true } : {}) }),
  cancelSale: (id: number) => post<Sale>(`/sales/${id}/cancel`),
  receivables: () => get<Sale[]>('/receivables'),

  cashCurrent: () => get<{ session: CashSession | null }>('/cash/current'),
  openCash: (d: { opening_amount: number; notes?: string }) => post<CashSession>('/cash/open', d),
  cashMove: (d: { kind: 'sangria' | 'reforco'; amount: number; note?: string }) => post<CashSession>('/cash/moves', d),
  closeCash: (d: { counted: Partial<Record<PayMethod, number>>; notes?: string }) => post<CashSession>('/cash/close', d),
  cashSessions: (limit = 30) => get<CashSession[]>(`/cash/sessions?limit=${limit}`),
  cashSession: (id: number) => get<CashSession>(`/cash/sessions/${id}`),

  expenses: (start: Date, end: Date) => get<Expense[]>(`/expenses?${range(start, end)}`),
  createExpense: (d: { description: string; category?: string; amount: number; paid: boolean; due_date?: string; repeat_months?: number }) => post<{ ok: boolean }>('/expenses', d),
  updateExpense: (id: number, d: Partial<{ description: string; category: string | null; amount: number; due_date: string | null }>) => put<Expense>(`/expenses/${id}`, d),
  payExpense: (id: number) => post<{ ok: boolean }>(`/expenses/${id}/pay`),
  deleteExpense: (id: number) => del<{ ok: boolean }>(`/expenses/${id}`),
  finance: (month: string) => get<Finance>(`/finance?month=${month}`),
  cashflow: (days = 30) => get<CashFlow>(`/cashflow?days=${days}`),

  reportSummary: (start: Date, end: Date) => get<ReportSummary>(`/reports/summary?${range(start, end)}`),
  commissionRates: () => get<CommissionRate[]>('/commission-rates'),
  setCommissionRate: (d: { user_id: number; category: string | null; pct: number }) => put<CommissionRate>('/commission-rates', d),
  deleteCommissionRate: (id: number) => del<{ ok: boolean }>(`/commission-rates/${id}`),
  commissionReport: (start: Date, end: Date) => get<CommissionRow[]>(`/reports/commissions?${range(start, end)}`),

  reminders: (days = 30) => get<Reminder[]>(`/reminders?days=${days}`),
}

/** Rotas do tutor (app PetLife) para o convite da clínica e o acesso concedido. */
const vet = <T,>(method: string, path: string, body?: unknown) => request<T>('/vet', method, path, body)
export const tutorClinic = {
  invite: (code: string) => vet<ClinicInviteInfo>('GET', `/clinic-invite/${encodeURIComponent(code)}`),
  accept: (code: string, d: { pet_id: number | null; create_pet: boolean; import_past_vaccines: boolean }) =>
    vet<{ ok: boolean; pet_id: number; clinic_name: string; imported_vaccines: number }>('POST', `/clinic-invite/${encodeURIComponent(code)}/accept`, d),
  access: () => vet<ClinicAccess[]>('GET', '/my-clinic-access'),
  revoke: (petId: number, clinicId: number) => vet<{ message: string }>('DELETE', `/pet/${petId}/share-clinic/${clinicId}`),
}
