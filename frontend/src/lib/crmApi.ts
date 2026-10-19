/** Cliente da API do PetLife Clínica (CRM). */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('petlife_token') : null
  const res = await fetch(`${API_URL}/crm${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    let msg = `Erro ${res.status}`
    try { const d = await res.json(); msg = Array.isArray(d.detail) ? 'Confira os dados informados.' : (d.detail || msg) } catch {}
    const e = new Error(msg) as Error & { status?: number }
    e.status = res.status
    throw e
  }
  const t = await res.text()
  return (t ? JSON.parse(t) : {}) as T
}
const get = <T,>(p: string) => req<T>('GET', p)
const post = <T,>(p: string, b?: unknown) => req<T>('POST', p, b ?? {})
const put = <T,>(p: string, b: unknown) => req<T>('PUT', p, b)
const patch = <T,>(p: string, b: unknown) => req<T>('PATCH', p, b)
const del = <T,>(p: string) => req<T>('DELETE', p)

export type Role = 'admin' | 'vet' | 'recepcao' | 'banho_tosa'
export interface CrmMe { user: { id: number; name: string; email: string; role: Role }; clinic: { id: number; name: string; cnpj: string | null; phone: string | null; email: string | null; address: string | null; city: string | null; state: string | null; plan: string; business_type: string } }
export interface Client { id: number; name: string; phone: string | null; email: string | null; document: string | null; address: string | null; notes: string | null; petlife_linked: boolean; created_at: string; patients?: Array<{ id: number; name: string; species: string }> }
export interface Patient { id: number; client_id: number; name: string; species: string; breed: string | null; sex: string | null; birth_date: string | null; weight_kg: number | null; neutered: boolean | null; microchip: string | null; color: string | null; notes: string | null; deceased: boolean; petlife_linked: boolean; created_at: string }
export interface Item { id: number; kind: 'service' | 'product'; category: string | null; name: string; sku: string | null; price: number; cost: number | null; stock_qty: number | null; min_stock: number | null; unit: string | null; duration_min: number | null; active: boolean; low_stock: boolean }
export interface Appt { id: number; client_id: number; patient_id: number | null; item_id: number | null; staff_user_id: number | null; type: string; status: string; starts_at: string; ends_at: string | null; price: number | null; notes: string | null; client_name: string | null; client_phone: string | null; patient_name: string | null; patient_species: string | null; staff_name: string | null }
export interface RecordEntry { id: number; patient_id: number; kind: string; title: string; body: string | null; weight_kg: number | null; temperature_c: number | null; vaccine_name: string | null; vaccine_lot: string | null; next_due: string | null; sent_to_app: boolean; staff_name: string | null; created_at: string }
export interface Sale { id: number; client_id: number | null; patient_id: number | null; appointment_id: number | null; subtotal: number; discount: number; total: number; payment_method: string | null; status: string; due_date: string | null; paid_at: string | null; notes: string | null; created_at: string; client_name: string | null; items?: Array<{ id: number; item_id: number | null; description: string; qty: number; unit_price: number; total: number }> }
export interface ClientFull extends Client { patients: Patient[]; appointments: Appt[]; sales: Sale[]; open_balance: number; total_spent: number }
export interface PatientFull extends Patient { client: Client | null; records: RecordEntry[]; appointments: Appt[]; app_vaccines: Array<{ name: string; date_given: string; next_due: string | null; veterinarian: string | null }> }
export interface Reminder { record_id: number; kind: string; what: string; next_due: string; overdue: boolean; patient_id: number; patient_name: string; client_id: number; client_name: string; client_phone: string | null; in_app: boolean }
export interface Member { id: number; user_id: number; name: string; email: string; role: Role; crmv: string | null; is_me: boolean }
export interface AppPet { pet_id: number; pet_name: string; species: string; owner_name: string; owner_email: string; owner_phone: string | null; granted_at: string; imported: boolean }
export interface Finance { month: string; revenue: number; expenses: number; profit: number; sales_count: number; avg_ticket: number; receivable_open: number; payable_open: number; by_day: Array<{ day: string; total: number }>; by_method: Array<{ method: string; total: number; count: number }>; by_category: Array<{ category: string; total: number }> }
export interface Expense { id: number; description: string; category: string | null; amount: number; due_date: string | null; paid_at: string | null }
export interface Dashboard { today: Appt[]; today_by_status: Record<string, number>; revenue_today: number; revenue_month: number; new_clients_month: number; total_clients: number; total_patients: number; low_stock: Item[]; reminders_due: number; app_patients_pending: number }

export const crm = {
  me: () => get<CrmMe>('/me'),
  updateClinic: (d: Partial<CrmMe['clinic']>) => put<{ ok: boolean }>('/clinic', d),
  dashboard: () => get<Dashboard>('/dashboard'),
  team: () => get<Member[]>('/team'),
  addMember: (d: { name: string; email: string; password?: string; role: Role; crmv?: string }) => post<{ ok: boolean; temporary_password: string | null }>('/team', d),
  patchMember: (id: number, d: { role?: Role; crmv?: string }) => patch<{ ok: boolean }>(`/team/${id}`, d),
  removeMember: (id: number) => del<{ ok: boolean }>(`/team/${id}`),
  clients: (q = '') => get<Client[]>(`/clients?q=${encodeURIComponent(q)}`),
  client: (id: number) => get<ClientFull>(`/clients/${id}`),
  createClient: (d: Partial<Client>) => post<Client>('/clients', d),
  updateClient: (id: number, d: Partial<Client>) => put<Client>(`/clients/${id}`, d),
  deleteClient: (id: number) => del<{ ok: boolean }>(`/clients/${id}`),
  patient: (id: number) => get<PatientFull>(`/patients/${id}`),
  createPatient: (d: Partial<Patient>) => post<Patient>('/patients', d),
  updatePatient: (id: number, d: Partial<Patient>) => put<Patient>(`/patients/${id}`, d),
  addRecord: (pid: number, d: Partial<RecordEntry> & { appointment_id?: number }) => post<RecordEntry>(`/patients/${pid}/records`, d),
  deleteRecord: (id: number) => del<{ ok: boolean }>(`/records/${id}`),
  appPatients: () => get<AppPet[]>('/app-patients'),
  importAppPatient: (petId: number) => post<{ patient_id: number; client_id: number; already: boolean }>(`/app-patients/${petId}/import`),
  items: (kind = '', includeInactive = false) => get<Item[]>(`/items?kind=${kind}&include_inactive=${includeInactive}`),
  createItem: (d: Partial<Item>) => post<Item>('/items', d),
  updateItem: (id: number, d: Partial<Item>) => put<Item>(`/items/${id}`, d),
  moveStock: (id: number, d: { qty: number; reason: string; note?: string }) => post<Item>(`/items/${id}/stock`, d),
  appointments: (start: Date, end: Date) => get<Appt[]>(`/appointments?start=${start.toISOString()}&end=${end.toISOString()}`),
  createAppt: (d: Partial<Appt>) => post<Appt>('/appointments', d),
  patchAppt: (id: number, d: Partial<Appt>) => patch<Appt>(`/appointments/${id}`, d),
  deleteAppt: (id: number) => del<{ ok: boolean }>(`/appointments/${id}`),
  sales: (start: Date, end: Date, status = '') => get<Sale[]>(`/sales?start=${start.toISOString()}&end=${end.toISOString()}&status=${status}`),
  sale: (id: number) => get<Sale>(`/sales/${id}`),
  createSale: (d: { client_id?: number | null; patient_id?: number | null; appointment_id?: number | null; items: Array<{ item_id?: number; description?: string; qty: number; unit_price?: number }>; discount: number; payment_method: string; status: string; notes?: string }) => post<Sale>('/sales', d),
  paySale: (id: number, method: string) => post<Sale>(`/sales/${id}/pay`, { payment_method: method }),
  cancelSale: (id: number) => post<Sale>(`/sales/${id}/cancel`),
  expenses: (start: Date, end: Date) => get<Expense[]>(`/expenses?start=${start.toISOString()}&end=${end.toISOString()}`),
  createExpense: (d: { description: string; category?: string; amount: number; paid: boolean; due_date?: string }) => post<{ ok: boolean }>('/expenses', d),
  payExpense: (id: number) => post<{ ok: boolean }>(`/expenses/${id}/pay`),
  deleteExpense: (id: number) => del<{ ok: boolean }>(`/expenses/${id}`),
  finance: (month: string) => get<Finance>(`/finance?month=${month}`),
  reminders: (days = 30) => get<Reminder[]>(`/reminders?days=${days}`),
}
