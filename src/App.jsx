import { useCallback, useEffect, useState } from 'react'
import logoUrl from '../Logo.jpg'
import { deleteActivities, isGoogleAppsScriptConfigured, listActivities, saveActivity } from './services/googleAppsScript'

const Icon = ({ name, className = 'h-5 w-5' }) => {
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    note: <><path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6M9 7h3"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    report: <><path d="M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 14v5h14v-5"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

const navItems = [
  { id: 'dashboard', label: 'หน้าหลัก', icon: 'home' },
  { id: 'create', label: 'สร้างกลุ่ม PLC', icon: 'plus' },
  { id: 'activity', label: 'บันทึกกิจกรรม', icon: 'note' },
  { id: 'groups', label: 'กลุ่ม PLC ของฉัน', icon: 'users' },
  { id: 'history', label: 'ประวัติกิจกรรม', icon: 'history' },
  { id: 'reports', label: 'รายงานและส่งออก', icon: 'report' },
]

const pageMeta = {
  dashboard: ['Dashboard', 'โรงเรียนหาดใหญ่รัฐประชาสรรค์'],
  create: ['สร้างกลุ่ม PLC', 'กำหนดข้อมูลพื้นฐาน สมาชิก และประเด็นพัฒนา'],
  activity: ['บันทึกกิจกรรม', 'บันทึกกระบวนการ PLC ทั้ง 7 ขั้นตอนและแนบรูปหลักฐาน'],
  groups: ['กลุ่ม PLC ของฉัน', 'ติดตามความคืบหน้าและจัดการสมาชิกในกลุ่ม'],
  history: ['ประวัติกิจกรรม', 'ตรวจสอบกิจกรรมและหลักฐานที่เคยบันทึก'],
  reports: ['รายงานและส่งออก', 'พิมพ์รายงานตามจำนวนกิจกรรมที่บันทึกไว้'],
}

const stats = [
  { title: 'กลุ่ม PLC', value: '0', icon: 'users', color: 'text-violet-700', bg: 'bg-violet-100' },
  { title: 'กิจกรรมทั้งหมด', value: '0', icon: 'note', color: 'text-orange-600', bg: 'bg-orange-100' },
  { title: 'ชั่วโมง PLC', value: '0', icon: 'clock', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  { title: 'ขั้นตอนที่ดำเนินการ', value: '0', icon: 'check', color: 'text-emerald-700', bg: 'bg-emerald-100' },
]

const plcSteps = [
  'สร้างกลุ่มและกำหนดสมาชิก',
  'ระบุปัญหาและเป้าหมาย',
  'วิเคราะห์สาเหตุของปัญหา',
  'ออกแบบแนวทางแก้ไข',
  'นำแนวทางไปใช้',
  'สะท้อนผลและแลกเปลี่ยนเรียนรู้',
  'สรุปผลและจัดทำรายงาน',
]

const inputClass = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
const ACTIVITY_CACHE_KEY = 'hrp-plc-activities'

function readCachedActivities() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACTIVITY_CACHE_KEY) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function writeCachedActivities(activities) {
  try { localStorage.setItem(ACTIVITY_CACHE_KEY, JSON.stringify(activities)) } catch { /* ใช้งานข้อมูลจาก Google Sheet ต่อได้ */ }
}

function mergeActivities(primary, fallback) {
  const merged = new Map(fallback.map((activity) => [activity.activityId, activity]))
  primary.forEach((activity) => merged.set(activity.activityId, activity))
  return [...merged.values()].sort((a, b) => String(b.activityDate || '').localeCompare(String(a.activityDate || '')) || Number(b.activityNo || 0) - Number(a.activityNo || 0))
}

function cacheActivity(activity) {
  const activities = readCachedActivities().filter((item) => item.activityId !== activity.activityId)
  writeCachedActivities(mergeActivities([activity], activities))
}

function removeCachedActivities(activityIds) {
  const idSet = new Set(activityIds)
  writeCachedActivities(readCachedActivities().filter((activity) => !idSet.has(activity.activityId)))
}

function FieldLabel({ children, required = false, hint }) {
  return (
    <label className="block text-sm font-bold text-slate-700">
      {children} {required && <span className="text-rose-500">*</span>}
      {hint && <span className="ml-2 text-xs font-normal text-slate-400">{hint}</span>}
    </label>
  )
}

function ActivityForm({ onCancel, initialActivity = null, onSaved }) {
  const [files, setFiles] = useState([])
  const [savedActivityId, setSavedActivityId] = useState(initialActivity?.activityId || '')
  const [saveState, setSaveState] = useState({ type: 'idle', message: '' })
  const localGroups = readLocalGroups()

  const handleFiles = (event) => {
    const selected = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024)
    setFiles((current) => [...current, ...selected].slice(0, 8))
    event.target.value = ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const submitStatus = event.nativeEvent.submitter?.value === 'draft' ? 'draft' : 'submitted'
    const formData = new FormData(event.currentTarget)
    const fields = Object.fromEntries(formData.entries())
    const captions = files.map((_, index) => formData.get(`imageCaption-${index}`) || '')

    setSaveState({ type: 'loading', message: submitStatus === 'draft' ? 'กำลังบันทึกร่าง...' : 'กำลังบันทึกกิจกรรมและอัปโหลดรูป...' })
    try {
      const result = await saveActivity({ fields, files, captions, status: submitStatus, activityId: savedActivityId })
      const cachedActivity = {
        ...initialActivity,
        ...fields,
        activityId: result.activityId,
        status: result.status || submitStatus,
        plcStep: Number(fields.plcStep),
        plcStepName: plcSteps[Number(fields.plcStep) - 1] || '',
        createdAt: initialActivity?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      cacheActivity(cachedActivity)
      setSavedActivityId(result.activityId)
      setFiles([])
      setSaveState({ type: 'success', message: result.message })
      onSaved?.(result)
    } catch (error) {
      setSaveState({ type: 'error', message: error.message })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-white"><Icon name="note" /></span>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-950">{initialActivity ? 'แก้ไขกิจกรรม PLC' : 'แบบบันทึกกิจกรรม PLC'}</h3>
                  <p className="mt-1 text-sm text-slate-500">ข้อมูลที่กรอกจะถูกนำไปจัดทำรายงานและสรุปชั่วโมง PLC</p>
                </div>
              </div>
            </div>
            <span className={`self-start rounded-full px-3 py-1.5 text-xs font-bold ${saveState.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              สถานะ: {saveState.type === 'success' ? 'บันทึกแล้ว' : 'แบบร่าง'}
            </span>
          </div>
        </div>

        <div className="space-y-8 p-6 sm:p-8">
          {!isGoogleAppsScriptConfigured() && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
              <strong>ยังไม่ได้เชื่อม Google Apps Script</strong><br />
              ฟอร์มพร้อมใช้งานแล้ว แต่ต้องเพิ่ม Web App URL และ App Key ลงในไฟล์ <code className="rounded bg-amber-100 px-1.5 py-0.5">.env.local</code> ก่อนบันทึกจริง
            </div>
          )}
          <section>
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-sm font-extrabold text-blue-700">1</span>
              <div>
                <h4 className="font-extrabold text-slate-900">ข้อมูลกิจกรรม</h4>
                <p className="text-xs text-slate-500">ระบุกลุ่ม ครั้งที่จัด และช่วงเวลาดำเนินกิจกรรม</p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div className="md:col-span-2">
                <FieldLabel required hint="ภายหลังจะเลือกจากฐานข้อมูล">ชื่อกลุ่ม PLC</FieldLabel>
                {localGroups.length ? (
                  <select required name="groupName" defaultValue={initialActivity?.groupName || ''} className={inputClass}>
                    <option value="" disabled>เลือกกลุ่ม PLC</option>
                    {localGroups.map((group) => <option key={group.groupId} value={group.groupName}>{group.groupName}</option>)}
                  </select>
                ) : (
                  <input required name="groupName" defaultValue={initialActivity?.groupName || ''} className={inputClass} placeholder="เช่น PLC พัฒนาทักษะการอ่านจับใจความ" />
                )}
              </div>
              <div>
                <FieldLabel required>กิจกรรมครั้งที่</FieldLabel>
                <input required name="activityNo" defaultValue={initialActivity?.activityNo || ''} min="1" type="number" className={inputClass} placeholder="1" />
              </div>
              <div>
                <FieldLabel required>วันที่ดำเนินกิจกรรม</FieldLabel>
                <input required name="activityDate" defaultValue={initialActivity?.activityDate || ''} type="date" className={inputClass} />
              </div>
              <div>
                <FieldLabel required>เวลาเริ่ม</FieldLabel>
                <input required name="startTime" defaultValue={initialActivity?.startTime || ''} type="time" className={inputClass} />
              </div>
              <div>
                <FieldLabel required>เวลาสิ้นสุด</FieldLabel>
                <input required name="endTime" defaultValue={initialActivity?.endTime || ''} type="time" className={inputClass} />
              </div>
              <div>
                <FieldLabel required>จำนวนชั่วโมง PLC</FieldLabel>
                <input required name="hours" defaultValue={initialActivity?.hours || ''} min="0.5" step="0.5" type="number" className={inputClass} placeholder="2" />
              </div>
              <div>
                <FieldLabel>สถานที่</FieldLabel>
                <input name="location" defaultValue={initialActivity?.location || ''} className={inputClass} placeholder="เช่น ห้องประชุมวิชาการ" />
              </div>
            </div>
          </section>

          <div className="border-t border-slate-200" />

          <section>
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-100 text-sm font-extrabold text-violet-700">2</span>
              <div>
                <h4 className="font-extrabold text-slate-900">ขั้นตอนและรายละเอียด</h4>
                <p className="text-xs text-slate-500">เลือกขั้นตอนให้ตรงกับหัวข้อที่จะปรากฏในรายงาน</p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <FieldLabel required>ขั้นตอนกระบวนการ PLC</FieldLabel>
                <select required name="plcStep" defaultValue={initialActivity?.plcStep || ''} className={inputClass}>
                  <option value="" disabled>เลือกขั้นตอน</option>
                  {plcSteps.map((step, index) => <option key={step} value={index + 1}>{index + 1}. {step}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel required>ชื่อกิจกรรม / หัวข้อการประชุม</FieldLabel>
                <input required name="title" defaultValue={initialActivity?.title || ''} className={inputClass} placeholder="ระบุหัวข้อกิจกรรมครั้งนี้" />
              </div>
              <div className="md:col-span-2">
                <FieldLabel required>วัตถุประสงค์</FieldLabel>
                <textarea required name="objective" defaultValue={initialActivity?.objective || ''} rows="3" className={inputClass} placeholder="กิจกรรมนี้จัดขึ้นเพื่ออะไร และต้องการพัฒนาเรื่องใด" />
              </div>
              <div className="md:col-span-2">
                <FieldLabel required>รายละเอียดการดำเนินกิจกรรม</FieldLabel>
                <textarea required name="details" defaultValue={initialActivity?.details || ''} rows="6" className={inputClass} placeholder="อธิบายสิ่งที่ร่วมกันวิเคราะห์ อภิปราย ทดลอง หรือดำเนินการตามลำดับ" />
                <p className="mt-2 text-xs text-slate-400">เขียนเป็นข้อความต่อเนื่อง ระบบจะนำส่วนนี้ไปสร้างเนื้อหาหลักของรายงาน</p>
              </div>
              <div>
                <FieldLabel required>ผลที่เกิดขึ้น / ข้อค้นพบ</FieldLabel>
                <textarea required name="result" defaultValue={initialActivity?.result || ''} rows="4" className={inputClass} placeholder="สรุปผลลัพธ์ การเปลี่ยนแปลง หรือข้อค้นพบจากกิจกรรม" />
              </div>
              <div>
                <FieldLabel>ปัญหาและอุปสรรค</FieldLabel>
                <textarea name="problems" defaultValue={initialActivity?.problems || ''} rows="4" className={inputClass} placeholder="ระบุปัญหาที่พบ หากไม่มีให้เว้นว่าง" />
              </div>
              <div className="md:col-span-2">
                <FieldLabel required>ข้อเสนอแนะ / แนวทางดำเนินการครั้งต่อไป</FieldLabel>
                <textarea required name="nextAction" defaultValue={initialActivity?.nextAction || ''} rows="3" className={inputClass} placeholder="ระบุสิ่งที่ต้องปรับปรุง ผู้รับผิดชอบ หรือสิ่งที่จะทำต่อในกิจกรรมครั้งหน้า" />
              </div>
            </div>
          </section>

          <div className="border-t border-slate-200" />

          <section>
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-sm font-extrabold text-emerald-700">3</span>
              <div>
                <h4 className="font-extrabold text-slate-900">ผู้เข้าร่วมกิจกรรม</h4>
                <p className="text-xs text-slate-500">ใช้แสดงรายชื่อผู้ร่วมแลกเปลี่ยนเรียนรู้ในรายงาน</p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <FieldLabel required>ผู้บันทึกกิจกรรม</FieldLabel>
                <input required name="recorder" className={inputClass} defaultValue={initialActivity?.recorder || 'คุณครูสุทธิดา'} />
              </div>
              <div>
                <FieldLabel required>จำนวนผู้เข้าร่วม</FieldLabel>
                <input required name="participantCount" defaultValue={initialActivity?.participantCount || ''} min="1" type="number" className={inputClass} placeholder="5" />
              </div>
              <div className="md:col-span-2">
                <FieldLabel required>รายชื่อผู้เข้าร่วม</FieldLabel>
                <textarea required name="participants" defaultValue={initialActivity?.participants || ''} rows="3" className={inputClass} placeholder="พิมพ์ชื่อ–นามสกุล คั่นแต่ละคนด้วยเครื่องหมายจุลภาค หรือขึ้นบรรทัดใหม่" />
              </div>
            </div>
          </section>

          <div className="border-t border-slate-200" />

          <section>
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-100 text-sm font-extrabold text-orange-700">4</span>
              <div>
                <h4 className="font-extrabold text-slate-900">รูปภาพหลักฐาน</h4>
                <p className="text-xs text-slate-500">รองรับ JPG, PNG และ WebP สูงสุด 8 รูปต่อกิจกรรม</p>
              </div>
            </div>

            <label className="grid cursor-pointer place-items-center rounded-[20px] border-2 border-dashed border-blue-200 bg-blue-50/50 p-8 text-center transition hover:border-blue-400 hover:bg-blue-50">
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleFiles} className="sr-only" />
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-100 text-blue-700"><Icon name="upload" /></span>
              <span className="mt-3 font-bold text-slate-800">คลิกเพื่อเลือกรูปภาพหลักฐาน</span>
              <span className="mt-1 text-xs text-slate-500">ควรเป็นภาพแนวนอน ภาพละไม่เกิน 10 MB</span>
            </label>

            {files.length > 0 && (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {files.map((file, index) => (
                  <div key={`${file.name}-${file.lastModified}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-blue-600 shadow-sm"><Icon name="image" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-700">{index + 1}. {file.name}</p>
                        <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button type="button" aria-label={`ลบรูป ${file.name}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-slate-400 transition hover:text-rose-600"><Icon name="trash" className="h-5 w-5" /></button>
                    </div>
                    <input name={`imageCaption-${index}`} className={`${inputClass} bg-white`} placeholder="คำบรรยายใต้ภาพ เช่น ร่วมกันวิเคราะห์ปัญหา" />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>

      <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.14)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button type="button" disabled={saveState.type === 'loading'} onClick={onCancel} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">ยกเลิกและกลับ</button>
          {saveState.message && (
            <p className={`mt-2 text-sm font-semibold sm:hidden ${saveState.type === 'error' ? 'text-rose-600' : saveState.type === 'success' ? 'text-emerald-600' : 'text-blue-600'}`}>{saveState.message}</p>
          )}
        </div>
        {saveState.message && (
          <p className={`hidden max-w-md text-sm font-semibold sm:block ${saveState.type === 'error' ? 'text-rose-600' : saveState.type === 'success' ? 'text-emerald-600' : 'text-blue-600'}`}>{saveState.message}</p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" name="submitStatus" value="draft" formNoValidate disabled={saveState.type === 'loading'} className="rounded-xl border border-blue-200 px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60">บันทึกร่าง</button>
          <button type="submit" name="submitStatus" value="submitted" disabled={saveState.type === 'loading'} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{saveState.type === 'loading' ? 'กำลังบันทึก...' : 'บันทึกกิจกรรม'}</button>
        </div>
      </div>
    </form>
  )
}

function GroupForm({ onCancel, onSaved }) {
  const [saveState, setSaveState] = useState({ type: 'idle', message: '' })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const fields = Object.fromEntries(new FormData(form).entries())

    setSaveState({ type: 'loading', message: 'กำลังสร้างกลุ่ม PLC...' })
    try {
      const savedGroups = readLocalGroups()
      savedGroups.push({
        groupId: crypto.randomUUID(),
        ...fields,
        status: 'active',
        createdAt: new Date().toISOString(),
      })
      localStorage.setItem('hrp-plc-groups', JSON.stringify(savedGroups))
      form.reset()
      setSaveState({ type: 'success', message: 'สร้างกลุ่ม PLC และบันทึกในระบบเรียบร้อยแล้ว' })
      onSaved?.()
    } catch (error) {
      setSaveState({ type: 'error', message: error.message || 'ไม่สามารถบันทึกกลุ่มในระบบได้' })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50 to-white px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-600 text-white"><Icon name="users" /></span>
            <div>
              <h3 className="text-xl font-extrabold text-slate-950">ข้อมูลกลุ่ม PLC</h3>
              <p className="mt-1 text-sm text-slate-500">สร้างข้อมูลกลุ่มสำหรับใช้อ้างอิงในการบันทึกกิจกรรม</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <FieldLabel required>ชื่อกลุ่ม PLC</FieldLabel>
              <input required name="groupName" className={inputClass} placeholder="เช่น PLC พัฒนาทักษะการอ่านจับใจความ" />
            </div>
            <div>
              <FieldLabel required>ปีการศึกษา</FieldLabel>
              <input required name="academicYear" type="number" min="2500" max="2700" className={inputClass} placeholder="2569" />
            </div>
            <div>
              <FieldLabel required>ภาคเรียน</FieldLabel>
              <select required name="semester" defaultValue="" className={inputClass}>
                <option value="" disabled>เลือกภาคเรียน</option>
                <option value="1">ภาคเรียนที่ 1</option>
                <option value="2">ภาคเรียนที่ 2</option>
                <option value="summer">ภาคฤดูร้อน</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <FieldLabel required>กลุ่มสาระการเรียนรู้</FieldLabel>
              <input required name="learningArea" className={inputClass} placeholder="เช่น สังคมศึกษา ศาสนาและวัฒนธรรม" />
            </div>
            <div className="md:col-span-2">
              <FieldLabel required>ประเด็นปัญหา / เรื่องที่ต้องการพัฒนา</FieldLabel>
              <textarea required name="issue" rows="4" className={inputClass} placeholder="ระบุปัญหา เป้าหมาย หรือประเด็นที่กลุ่มต้องการร่วมกันพัฒนา" />
            </div>
            <div>
              <FieldLabel required>ชื่อผู้รับผิดชอบกลุ่ม</FieldLabel>
              <input required name="ownerName" className={inputClass} placeholder="ชื่อ-นามสกุล" />
            </div>
            <div>
              <FieldLabel>อีเมลผู้รับผิดชอบ</FieldLabel>
              <input name="ownerEmail" type="email" className={inputClass} placeholder="name@school.ac.th" />
            </div>
            <div>
              <FieldLabel required>Model Teacher</FieldLabel>
              <input required name="modelTeacher" defaultValue="นางสาวสิริมา นิยมเดชา" className={inputClass} />
            </div>
            <div>
              <FieldLabel required>Buddy Teacher</FieldLabel>
              <input required name="buddyTeacher" defaultValue="ว่าที่ร้อยตรีหญิงสุทธิดา แซ่หล่อ" className={inputClass} />
            </div>
            <div>
              <FieldLabel required>Mentor / ผู้เชี่ยวชาญ</FieldLabel>
              <input required name="mentorTeacher" defaultValue="นายณัฐพล เนียมสง" className={inputClass} />
            </div>
            <div>
              <FieldLabel required>หัวหน้ากลุ่มสาระ</FieldLabel>
              <input required name="subjectHead" defaultValue="นางสาวจรัสศรี ทองเลิศ" className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <FieldLabel required hint="หนึ่งคนต่อหนึ่งบรรทัด">รายชื่อสมาชิกกลุ่ม</FieldLabel>
              <textarea required name="members" rows="5" className={inputClass} placeholder={'นายสมชาย ใจดี\nนางสาวสมหญิง ตั้งใจ'} />
            </div>
          </div>

          {saveState.message && (
            <div className={`rounded-2xl px-5 py-4 text-sm font-semibold ${saveState.type === 'error' ? 'border border-rose-200 bg-rose-50 text-rose-700' : saveState.type === 'success' ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-blue-200 bg-blue-50 text-blue-700'}`}>
              {saveState.message}
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
        <button type="button" onClick={onCancel} disabled={saveState.type === 'loading'} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">ยกเลิก</button>
        <button type="submit" disabled={saveState.type === 'loading'} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
          {saveState.type === 'loading' ? 'กำลังสร้างกลุ่ม...' : 'สร้างกลุ่ม PLC'}
        </button>
      </div>
    </form>
  )
}

function readLocalGroups() {
  try {
    const saved = JSON.parse(localStorage.getItem('hrp-plc-groups') || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function GroupsPage({ onNavigate }) {
  const [groups, setGroups] = useState(readLocalGroups)

  const handleDeleteGroup = (group) => {
    if (!window.confirm(`ต้องการลบกลุ่ม “${group.groupName}” ออกจากเบราว์เซอร์นี้ใช่หรือไม่?\n\nประวัติกิจกรรมที่บันทึกใน Google Sheet จะยังคงอยู่`)) return
    const nextGroups = groups.filter((item) => item.groupId !== group.groupId)
    localStorage.setItem('hrp-plc-groups', JSON.stringify(nextGroups))
    setGroups(nextGroups)
  }

  if (!groups.length) return <div className="grid min-h-72 place-items-center rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center"><div><p className="font-bold text-slate-800">ยังไม่มีกลุ่ม PLC ในเบราว์เซอร์นี้</p><button type="button" onClick={() => onNavigate('create')} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">+ สร้างกลุ่มใหม่</button></div></div>

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">พบทั้งหมด {groups.length} กลุ่มในเบราว์เซอร์นี้</p>
        <button type="button" onClick={() => onNavigate('create')} className="self-start rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700">+ สร้างกลุ่มใหม่</button>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map((group) => {
          const memberCount = String(group.members || '').split(/\r?\n/).filter((member) => member.trim()).length
          return (
            <article key={group.groupId} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-950">{group.groupName}</h3>
                  <p className="mt-1 text-sm text-slate-500">ปีการศึกษา {group.academicYear} · ภาคเรียน {group.semester}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">กำลังดำเนินการ</span>
                  <button type="button" onClick={() => handleDeleteGroup(group)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50"><Icon name="trash" className="h-4 w-4" />ลบกลุ่ม</button>
                </div>
              </div>
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">ประเด็นพัฒนา</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{group.issue}</p>
              </div>
              <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <p><strong className="text-slate-800">ผู้รับผิดชอบ:</strong> {group.ownerName}</p>
                <p><strong className="text-slate-800">สมาชิก:</strong> {memberCount} คน</p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function useActivities(includeImages = false, allowCache = true) {
  const cachedActivities = readCachedActivities()
  const [state, setState] = useState({ loading: !allowCache || cachedActivities.length === 0, activities: allowCache ? cachedActivities : [], error: '', notice: '' })

  const load = useCallback(async () => {
    const cached = readCachedActivities()
    setState((current) => ({ ...current, loading: !allowCache || current.activities.length === 0, error: '', notice: '' }))
    try {
      const remoteActivities = await listActivities({ includeImages })
      const activities = allowCache ? mergeActivities(remoteActivities, cached) : remoteActivities
      writeCachedActivities(activities.map(({ images: _images, ...activity }) => activity))
      setState({ loading: false, activities, error: '', notice: '' })
    } catch (error) {
      if (allowCache && cached.length) {
        setState({ loading: false, activities: cached, error: '', notice: 'กำลังแสดงประวัติที่บันทึกไว้ในเบราว์เซอร์ เนื่องจากยังโหลดข้อมูลจาก Google Sheet ไม่สำเร็จ' })
      } else {
        setState({ loading: false, activities: [], error: error.message, notice: '' })
      }
    }
  }, [allowCache, includeImages])

  useEffect(() => { load() }, [load])
  return { ...state, reload: load }
}

function LoadingPanel({ message }) {
  return <div className="grid min-h-72 place-items-center rounded-[24px] border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-blue-600 shadow-sm">{message}</div>
}

function HistoryPage({ onEdit, onNavigate }) {
  const { activities, loading, error, notice, reload } = useActivities(true)
  const [query, setQuery] = useState('')
  const [details, setDetails] = useState({})
  const [deletingId, setDeletingId] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const toggleDetails = (activity) => {
    if (details[activity.activityId]) {
      setDetails((current) => ({ ...current, [activity.activityId]: null }))
      return
    }
    setDetails((current) => ({ ...current, [activity.activityId]: activity }))
  }

  const handleDeleteActivity = async (activity) => {
    if (!window.confirm(`ต้องการลบกิจกรรม “${activity.title}” ใช่หรือไม่?\n\nข้อมูลใน Google Sheet รูปภาพ และโฟลเดอร์กิจกรรมใน Drive จะถูกย้ายไปถังขยะ`)) return
    setDeletingId(activity.activityId)
    setDeleteError('')
    try {
      await deleteActivities([activity.activityId])
      removeCachedActivities([activity.activityId])
      setDetails((current) => ({ ...current, [activity.activityId]: null }))
      await reload()
    } catch (deleteActivityError) {
      setDeleteError(deleteActivityError.message)
    } finally {
      setDeletingId('')
    }
  }

  if (loading) return <LoadingPanel message="กำลังโหลดประวัติกิจกรรม..." />
  if (error) {
    return (
      <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-8 text-center text-rose-700">
        <p className="font-bold">โหลดประวัติกิจกรรมไม่สำเร็จ</p>
        <p className="mt-2 text-sm">{error}</p>
        <button type="button" onClick={reload} className="mt-5 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white">ลองใหม่</button>
      </div>
    )
  }
  if (!activities.length) {
    return (
      <div className="grid min-h-80 place-items-center rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center">
        <div><p className="font-bold text-slate-800">ยังไม่มีประวัติกิจกรรม</p><button type="button" onClick={() => onNavigate('activity')} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">บันทึกกิจกรรมแรก</button></div>
      </div>
    )
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filteredActivities = activities.filter((activity) => !normalizedQuery || [activity.groupName, activity.title, activity.recorder, activity.activityDate].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)))

  return (
    <section className="space-y-4">
      {notice && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">{notice}</div>}
      {deleteError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{deleteError}</div>}
      <div className="flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <input value={query} onChange={(event) => setQuery(event.target.value)} className={inputClass.replace('mt-2 ', '')} placeholder="ค้นหาชื่อกลุ่ม ชื่อกิจกรรม ผู้บันทึก หรือวันที่" />
        <button type="button" onClick={reload} className="shrink-0 rounded-xl border border-blue-200 px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50">รีเฟรชข้อมูล</button>
      </div>
      {!filteredActivities.length && <div className="rounded-[20px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">ไม่พบกิจกรรมที่ตรงกับคำค้นหา</div>}
      {filteredActivities.map((activity) => (
        <article key={activity.activityId} className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">ขั้นตอนที่ {activity.plcStep}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${activity.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{activity.status === 'draft' ? 'แบบร่าง' : 'บันทึกแล้ว'}</span>
              </div>
              <h3 className="mt-3 text-lg font-extrabold text-slate-950">{activity.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{activity.groupName} · ครั้งที่ {activity.activityNo} · {activity.activityDate} · {activity.hours} ชั่วโมง</p>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{activity.details}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => toggleDetails(activity)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">{details[activity.activityId] ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}</button>
              <button type="button" onClick={() => onEdit(details[activity.activityId] || activity)} className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-50">แก้ไข</button>
              <button type="button" onClick={() => handleDeleteActivity(activity)} disabled={Boolean(deletingId)} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"><Icon name="trash" className="h-4 w-4" />{deletingId === activity.activityId ? 'กำลังลบ...' : 'ลบ'}</button>
            </div>
          </div>
          {details[activity.activityId] && (
            <div className="mt-5 space-y-5 border-t border-slate-200 pt-5">
              <dl className="grid gap-4 text-sm md:grid-cols-2">
                <div><dt className="font-bold text-slate-500">วัตถุประสงค์</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{details[activity.activityId].objective || '-'}</dd></div>
                <div><dt className="font-bold text-slate-500">ผลที่เกิดขึ้น</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{details[activity.activityId].result || '-'}</dd></div>
                <div><dt className="font-bold text-slate-500">ปัญหาและอุปสรรค</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{details[activity.activityId].problems || '-'}</dd></div>
                <div><dt className="font-bold text-slate-500">แนวทางครั้งต่อไป</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{details[activity.activityId].nextAction || '-'}</dd></div>
                <div className="md:col-span-2"><dt className="font-bold text-slate-500">รายละเอียดกิจกรรม</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{details[activity.activityId].details || '-'}</dd></div>
                <div className="md:col-span-2"><dt className="font-bold text-slate-500">ผู้เข้าร่วม</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{details[activity.activityId].participants || '-'}</dd></div>
              </dl>
              <div>
                <p className="text-sm font-bold text-slate-500">รูปภาพหลักฐาน ({details[activity.activityId].images?.length || 0})</p>
                {details[activity.activityId].images?.length ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {details[activity.activityId].images.map((image, index) => <figure key={`${activity.activityId}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={image.url} alt={image.caption || `รูปหลักฐาน ${index + 1}`} className="h-40 w-full object-cover" /><figcaption className="p-3 text-xs text-slate-600">{image.caption || `รูปหลักฐาน ${index + 1}`}</figcaption></figure>)}
                  </div>
                ) : <p className="mt-2 text-sm text-slate-400">กิจกรรมนี้ยังไม่มีรูปภาพหลักฐาน</p>}
              </div>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character])
}

function printGroupReport(groupName, activities) {
  const reportWindow = window.open('', '_blank')
  if (!reportWindow) return false
  const reportLogoUrl = new URL(logoUrl, window.location.href).href
  const ordered = [...activities].sort((a, b) => Number(a.plcStep) - Number(b.plcStep))
  const totalHours = ordered.reduce((sum, activity) => sum + Number(activity.hours || 0), 0)
  const group = readLocalGroups().find((item) => item.groupName === groupName) || {}
  const modelTeacher = group.modelTeacher || 'นางสาวสิริมา นิยมเดชา'
  const buddyTeacher = group.buddyTeacher || 'ว่าที่ร้อยตรีหญิงสุทธิดา แซ่หล่อ'
  const mentorTeacher = group.mentorTeacher || 'นายณัฐพล เนียมสง'
  const subjectHead = group.subjectHead || 'นางสาวจรัสศรี ทองเลิศ'
  const members = String(group.members || ordered[0]?.participants || '').split(/\r?\n|,/).map((name) => name.trim()).filter(Boolean).join(', ')
  const thaiDate = (value) => {
    if (!value) return '-'
    const date = new Date(`${value}T00:00:00`)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  const signature = (name, role) => `<div class="signature"><div>ลงชื่อ........................................................</div><div>(${escapeHtml(name)})</div><strong>${escapeHtml(role)}</strong></div>`
  const scheduleRows = ordered.map((activity) => {
    const time = [activity.startTime, activity.endTime].filter(Boolean).join(' - ') || '-'
    const activityDetail = [activity.title, activity.details].filter(Boolean).join('\n') || '-'
    return `<tr>
      <td>${escapeHtml(activity.activityNo)}</td>
      <td>${escapeHtml(thaiDate(activity.activityDate))}</td>
      <td>${escapeHtml(time)}</td>
      <td>${escapeHtml(activity.hours)}</td>
      <td class="schedule-activity">${escapeHtml(activityDetail)}</td>
    </tr>`
  }).join('')
  const activityPages = ordered.map((activity) => {
    const images = Array.isArray(activity.images) ? activity.images.slice(0, 4) : []
    const imageCells = Array.from({ length: 4 }, (_, index) => {
      const image = images[index]
      return image
        ? `<div class="photo"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.caption || `รูปหลักฐาน ${index + 1}`)}"><span>${escapeHtml(image.caption || '')}</span></div>`
        : '<div class="photo empty">ไม่มีรูปภาพ</div>'
    }).join('')
    return `<section class="page activity-page">
      <div class="activity-heading"><strong>กิจกรรม PLC ครั้งที่ ${escapeHtml(activity.activityNo)}</strong><span>${escapeHtml(thaiDate(activity.activityDate))} | ${escapeHtml(activity.hours)} ชั่วโมง</span></div>
      <table class="activity-table"><tbody>
        <tr><th>ชื่อกลุ่ม PLC</th><td>${escapeHtml(groupName)}</td></tr>
        <tr><th>ขั้นตอน</th><td>${escapeHtml(activity.plcStep)}. ${escapeHtml(activity.plcStepName)}</td></tr>
        <tr><th>รายละเอียดกิจกรรม</th><td><strong>${escapeHtml(activity.title)}</strong><br>${escapeHtml(activity.details)}</td></tr>
        <tr><th>ผลที่เกิดขึ้น</th><td>${escapeHtml(activity.result)}</td></tr>
        <tr><th>ปัญหาและอุปสรรค</th><td>${escapeHtml(activity.problems || '-')}</td></tr>
        <tr><th>แนวทางพัฒนาครั้งต่อไป</th><td>${escapeHtml(activity.nextAction)}</td></tr>
      </tbody></table>
      <h3 class="evidence-title">รูปภาพหลักฐาน</h3><div class="photo-grid">${imageCells}</div>
      <div class="signature-row">${signature(modelTeacher, 'Model Teacher')}${signature(buddyTeacher, 'Buddy Teacher')}${signature(mentorTeacher, 'Mentor / ผู้เชี่ยวชาญ')}</div>
      <div class="subject-head">${signature(subjectHead, `หัวหน้ากลุ่มสาระการเรียนรู้${group.learningArea || 'สังคมศึกษา ศาสนาและวัฒนธรรม'}`)}</div>
      <div class="opinion"><strong>ความคิดเห็นของหัวหน้ากลุ่มงาน</strong><div class="writing-lines">................................................................................................................................................................<br>................................................................................................................................................................</div><div class="signature-row two">${signature('นายบุญสุเทพ ยิ่งกุลมงคล', 'หัวหน้ากลุ่มบริหารวิชาการ')}${signature('นางสาววีรภา มณีรัตน์', 'รองผู้อำนวยการกลุ่มบริหารวิชาการ')}</div></div>
      <div class="opinion director"><strong>ความคิดเห็นของผู้อำนวยการโรงเรียน</strong><div class="writing-lines">................................................................................................................................................................<br>................................................................................................................................................................</div>${signature('นายอภัย ภัยมณี', 'ผู้อำนวยการโรงเรียนหาดใหญ่รัฐประชาสรรค์')}</div>
    </section>`
  }).join('')

  const cover = `<section class="page cover">
    <img class="report-logo" src="${escapeHtml(reportLogoUrl)}" alt="ตราโรงเรียนหาดใหญ่รัฐประชาสรรค์">
    <h1>รายงานผลการดำเนินงานชุมชนแห่งการเรียนรู้ทางวิชาชีพ (PLC)</h1>
    <p class="school">โรงเรียนหาดใหญ่รัฐประชาสรรค์ ภาคเรียนที่ ${escapeHtml(group.semester || '-')} ปีการศึกษา ${escapeHtml(group.academicYear || new Date().getFullYear() + 543)}</p>
    <dl>
      <dt>ชื่อกลุ่ม PLC</dt><dd>${escapeHtml(groupName)}</dd>
      <dt>กลุ่มสาระการเรียนรู้</dt><dd>${escapeHtml(group.learningArea || 'สังคมศึกษา ศาสนาและวัฒนธรรม')}</dd>
      <dt>ประเด็นปัญหา</dt><dd>${escapeHtml(group.issue || ordered[0]?.objective || '-')}</dd>
      <dt>Model Teacher</dt><dd>${escapeHtml(modelTeacher)}</dd>
      <dt>Buddy Teacher</dt><dd>${escapeHtml(buddyTeacher)}</dd>
      <dt>Mentor / ผู้เชี่ยวชาญ</dt><dd>${escapeHtml(mentorTeacher)}</dd>
      <dt>สมาชิก</dt><dd>${escapeHtml(members || '-')}</dd>
      <dt>สรุปการดำเนินงาน</dt><dd>${ordered.length} กิจกรรม รวม ${totalHours} ชั่วโมง ดำเนินการ ${new Set(ordered.map((activity) => Number(activity.plcStep))).size} จาก 7 ขั้นตอน</dd>
    </dl>
    <h2>ปฏิทินการดำเนินงานชุมชนการเรียนรู้ทางวิชาชีพ PLC</h2>
    <table class="schedule-table">
      <thead><tr><th>ครั้งที่</th><th>วันที่</th><th>เวลา</th><th>จำนวนชั่วโมง</th><th>กิจกรรม</th></tr></thead>
      <tbody>${scheduleRows}</tbody>
      <tfoot><tr><th colspan="3">รวมทั้งสิ้น</th><th>${escapeHtml(totalHours)}</th><th>${ordered.length} ครั้ง</th></tr></tfoot>
    </table>
  </section>`

  reportWindow.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงาน PLC - ${escapeHtml(groupName)}</title><style>
    @page{size:A4;margin:10mm 12mm}*{box-sizing:border-box}body{margin:0;background:#e5e7eb;font-family:"TH SarabunPSK","TH Sarabun New",sans-serif;color:#000;line-height:1.28;font-size:16pt}.page{width:210mm;min-height:297mm;margin:10px auto;padding:13mm 14mm;background:#fff;page-break-after:always}.page:last-child{page-break-after:auto}.cover{padding-top:25mm}.cover h1{text-align:center;font-size:24pt;line-height:1.2;margin:0}.school{text-align:center;font-size:19pt;margin:8px 0 25px}.cover dl{display:grid;grid-template-columns:48mm 1fr;gap:8px;font-size:17pt}.cover dt{font-weight:bold}.cover dd{margin:0}.cover h2{margin-top:22px;font-size:20pt}.activity-heading{display:flex;justify-content:space-between;border-bottom:1px solid #111;padding-bottom:5px;margin-bottom:6px;font-size:17pt}.activity-table{width:100%;border-collapse:collapse;font-size:14pt;line-height:1.18}.activity-table th,.activity-table td{border:1px solid #333;padding:3px 6px;vertical-align:top}.activity-table td{white-space:pre-wrap}.activity-table th{width:42mm;text-align:center;font-weight:bold}.evidence-title{font-size:16pt;margin:6px 0 3px}.photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px}.photo{height:29mm;border:1px solid #777;overflow:hidden;position:relative;display:grid;place-items:center;background:#fff;font-size:13pt}.photo img{display:block;width:100%;height:100%;object-fit:contain;object-position:center center}.photo span{position:absolute;bottom:0;left:0;right:0;padding:1px 4px;background:rgba(255,255,255,.86);font-size:11pt}.photo.empty{color:#555;border-radius:7px}.signature-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:5px;text-align:center}.signature-row.two{grid-template-columns:1fr 1fr}.signature{font-size:12pt;line-height:1.2}.signature strong{display:block;font-size:12.5pt}.subject-head{width:55%;margin:4px auto 0;text-align:center}.opinion{border-top:1px solid #111;border-bottom:1px solid #111;margin-top:5px;padding:3px 6px;text-align:left;font-size:12pt;line-height:1.2}.opinion>strong{display:block;font-size:13pt}.writing-lines{line-height:1.25;color:#333}.opinion .signature-row{margin-top:1px}.director{text-align:center}.director>.signature{width:58%;margin:1px auto 0}.print-button{position:fixed;right:20px;top:20px;z-index:10;padding:11px 20px;background:#2563eb;color:white;border:0;border-radius:9px;font-family:"TH SarabunPSK","TH Sarabun New",sans-serif;font-size:16pt;font-weight:bold;box-shadow:0 4px 14px #0003}@media print{body{background:#fff}.page{margin:0;padding:10mm 12mm;box-shadow:none}.print-button{display:none}}
    .page{position:relative}.photo{height:60mm}.signature-row,.subject-head,.opinion{break-inside:avoid;page-break-inside:avoid}.report-logo{position:absolute;top:8mm;left:12mm;width:22mm;height:22mm;object-fit:contain;object-position:center}.cover{padding-top:22mm}.cover h1{padding-left:18mm;padding-right:18mm}.cover .school{margin:5px 0 10px}.cover dl{gap:3px;font-size:14pt;margin:0}.cover h2{text-align:center;margin:10px 0 5px;font-size:18pt}.schedule-table{width:100%;border-collapse:collapse;font-size:11.5pt;line-height:1.12}.schedule-table th,.schedule-table td{border:1px solid #222;padding:3px 5px;vertical-align:middle;text-align:center}.schedule-table th:nth-child(1){width:12mm}.schedule-table th:nth-child(2){width:31mm}.schedule-table th:nth-child(3){width:27mm}.schedule-table th:nth-child(4){width:21mm}.schedule-table .schedule-activity{text-align:left;white-space:pre-wrap}.schedule-table thead,.schedule-table tfoot{background:#f1f5f9;font-weight:bold}
  </style></head><body><button class="print-button" onclick="window.print()">พิมพ์ / บันทึก PDF</button>${cover}${activityPages}</body></html>`)
  reportWindow.document.close()
  reportWindow.focus()
  return true
}

function downloadActivitiesCsv(groupName, activities) {
  const columns = [
    ['ครั้งที่', 'activityNo'], ['วันที่', 'activityDate'], ['เวลาเริ่ม', 'startTime'], ['เวลาสิ้นสุด', 'endTime'],
    ['ชั่วโมง', 'hours'], ['ขั้นตอน PLC', 'plcStep'], ['ชื่อขั้นตอน', 'plcStepName'], ['ชื่อกิจกรรม', 'title'],
    ['วัตถุประสงค์', 'objective'], ['รายละเอียด', 'details'], ['ผลที่เกิดขึ้น', 'result'], ['ปัญหาและอุปสรรค', 'problems'],
    ['แนวทางครั้งต่อไป', 'nextAction'], ['ผู้บันทึก', 'recorder'], ['จำนวนผู้เข้าร่วม', 'participantCount'], ['รายชื่อผู้เข้าร่วม', 'participants'],
  ]
  const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const rows = [columns.map(([label]) => csvCell(label)).join(','), ...activities.map((activity) => columns.map(([, key]) => csvCell(activity[key])).join(','))]
  const blob = new Blob([`\uFEFF${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `PLC-${groupName.replace(/[\\/:*?"<>|]/g, '-')}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function ReportsPage() {
  const { activities, loading, error, reload } = useActivities(true, false)
  const [exportError, setExportError] = useState('')
  const [deletingGroup, setDeletingGroup] = useState('')

  const handleDeleteReport = async (groupName, groupActivities) => {
    if (!window.confirm(`ต้องการลบรายงานของกลุ่ม “${groupName}” ใช่หรือไม่?\n\nกิจกรรมทั้ง ${groupActivities.length} รายการ รวมถึงรูปภาพและโฟลเดอร์ใน Drive จะถูกย้ายไปถังขยะ`)) return
    const activityIds = groupActivities.map((activity) => activity.activityId)
    setDeletingGroup(groupName)
    setExportError('')
    try {
      await deleteActivities(activityIds)
      removeCachedActivities(activityIds)
      await reload()
    } catch (deleteReportError) {
      setExportError(deleteReportError.message)
    } finally {
      setDeletingGroup('')
    }
  }

  if (loading) return <LoadingPanel message="กำลังตรวจสอบความครบถ้วนของรายงาน..." />
  if (error) return <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-8 text-center text-rose-700"><p className="font-bold">โหลดข้อมูลรายงานไม่สำเร็จ</p><p className="mt-2 text-sm">{error}</p><button type="button" onClick={reload} className="mt-5 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white">ลองใหม่</button></div>

  const grouped = activities.filter((activity) => activity.status !== 'draft').reduce((result, activity) => {
    if (!result[activity.groupName]) result[activity.groupName] = []
    result[activity.groupName].push(activity)
    return result
  }, {})
  const entries = Object.entries(grouped)
  if (!entries.length) return <LoadingPanel message="ยังไม่มีกิจกรรมที่บันทึกสมบูรณ์สำหรับจัดทำรายงาน" />

  return (
    <section className="space-y-5">
      {exportError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{exportError}</div>}
      <div className="grid gap-5 lg:grid-cols-2">
      {entries.map(([groupName, groupActivities]) => {
        const completedSteps = new Set(groupActivities.map((activity) => Number(activity.plcStep))).size
        const activityCount = groupActivities.length
        return (
          <article key={groupName} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <h3 className="text-lg font-extrabold text-slate-950">{groupName}</h3>
            <p className="mt-2 text-sm text-slate-500">บันทึกแล้ว {activityCount} กิจกรรม · ครอบคลุม {completedSteps} จาก 7 ขั้นตอน</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, completedSteps / 7 * 100)}%` }} /></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <button type="button" onClick={() => { setExportError(''); if (!printGroupReport(groupName, groupActivities)) setExportError('เบราว์เซอร์ปิดกั้นหน้ารายงาน กรุณาอนุญาต Pop-up แล้วลองใหม่') }} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700">พิมพ์ / บันทึก PDF</button>
              <button type="button" onClick={() => downloadActivitiesCsv(groupName, groupActivities)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100">ดาวน์โหลด CSV</button>
              <button type="button" onClick={() => handleDeleteReport(groupName, groupActivities)} disabled={Boolean(deletingGroup)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-600 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60"><Icon name="trash" className="h-4 w-4" />{deletingGroup === groupName ? 'กำลังลบ...' : 'ลบรายงาน'}</button>
            </div>
          </article>
        )
      })}
      </div>
    </section>
  )
}

function EmptyPage({ activePage, onNavigate }) {
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)

  if (activePage === 'create') {
    return <GroupForm onCancel={() => onNavigate('dashboard')} onSaved={() => onNavigate('groups')} />
  }

  if (activePage === 'groups') {
    const savedGroups = readLocalGroups()
    if (savedGroups.length) return <GroupsPage onNavigate={onNavigate} />
  }

  if (activePage === 'history' && editingActivity) {
    return <ActivityForm initialActivity={editingActivity} onCancel={() => setEditingActivity(null)} onSaved={() => setEditingActivity(null)} />
  }

  if (activePage === 'history') return <HistoryPage onEdit={setEditingActivity} onNavigate={onNavigate} />
  if (activePage === 'reports') return <ReportsPage />

  if (activePage === 'activity' && showActivityForm) {
    return <ActivityForm onCancel={() => setShowActivityForm(false)} />
  }

  const content = {
    create: {
      icon: 'users',
      title: 'เริ่มต้นสร้างกลุ่ม PLC',
      description: 'กรอกชื่อกลุ่ม ปีการศึกษา ประเด็นพัฒนา และเพิ่มสมาชิกก่อนเริ่มบันทึกกิจกรรม',
      button: '+ สร้างกลุ่มใหม่',
    },
    activity: {
      icon: 'note',
      title: 'บันทึกกิจกรรมตามกระบวนการ',
      description: 'เลือกกลุ่ม ระบุขั้นตอน บันทึกรายละเอียด เวลา และอัปโหลดรูปภาพหลักฐานสำหรับรายงาน',
      button: 'เริ่มบันทึกกิจกรรม',
    },
    groups: {
      icon: 'users',
      title: 'ยังไม่มีกลุ่ม PLC',
      description: 'เมื่อสร้างกลุ่มแล้ว คุณจะติดตามสมาชิก กิจกรรม และความคืบหน้าของรายงานได้จากหน้านี้',
      button: 'สร้างกลุ่ม PLC',
    },
    history: {
      icon: 'history',
      title: 'ยังไม่มีประวัติกิจกรรม',
      description: 'รายการกิจกรรม รูปหลักฐาน และผู้บันทึกจะแสดงเรียงตามวันที่ในพื้นที่นี้',
      button: 'บันทึกกิจกรรมแรก',
    },
    reports: {
      icon: 'report',
      title: 'รายงาน PLC ยังไม่พร้อม',
      description: 'รายงานจะรวบรวมข้อมูลกลุ่ม กระบวนการทั้ง 7 ขั้นตอน และรูปหลักฐานให้อยู่ในรูปแบบเดียวกับเอกสารต้นฉบับ',
      button: 'ดูรายการที่ต้องบันทึก',
    },
  }[activePage]

  const destinations = { create: 'create', activity: 'activity', groups: 'create', history: 'activity', reports: 'activity' }

  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8">
      {activePage === 'reports' && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {['ข้อมูลกลุ่ม', 'กิจกรรม 7 ขั้นตอน', 'รูปภาพหลักฐาน', 'ตรวจสอบและส่งออก'].map((item, index) => (
            <div key={item} className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
              <span className="text-xs font-bold text-blue-600">ขั้นที่ {index + 1}</span>
              <p className="mt-1 font-semibold text-slate-800">{item}</p>
            </div>
          ))}
        </div>
      )}
      <div className="grid min-h-[360px] place-items-center rounded-[22px] border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
        <div className="max-w-lg">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-100 text-blue-700">
            <Icon name={content.icon} className="h-8 w-8" />
          </div>
          <h3 className="mt-5 text-xl font-bold text-slate-900">{content.title}</h3>
          <p className="mt-2 leading-7 text-slate-500">{content.description}</p>
          <button type="button" onClick={() => activePage === 'activity' ? setShowActivityForm(true) : onNavigate(destinations[activePage])} className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700">
            {content.button}
          </button>
        </div>
      </div>
    </section>
  )
}

function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [title, subtitle] = pageMeta[activePage]
  const localGroups = readLocalGroups()
  const dashboardStats = stats.map((item, index) => index === 0 ? { ...item, value: String(localGroups.length) } : item)

  const navigate = (page) => {
    setActivePage(page)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-800">
      <button type="button" aria-label="เปิดเมนู" onClick={() => setMenuOpen(true)} className="fixed left-4 top-4 z-40 grid h-11 w-11 place-items-center rounded-xl bg-blue-700 text-white shadow-lg lg:hidden">
        <Icon name="menu" />
      </button>

      {menuOpen && <button type="button" aria-label="ปิดเมนู" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col bg-gradient-to-b from-[#2658dc] to-[#1f449b] px-5 py-6 text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button type="button" aria-label="ปิดเมนู" onClick={() => setMenuOpen(false)} className="absolute right-4 top-4 text-blue-100 lg:hidden">
          <Icon name="close" />
        </button>

        <div className="flex items-center gap-3 px-2">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg">
            <img src={logoUrl} alt="ตราโรงเรียนหาดใหญ่รัฐประชาสรรค์" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold leading-tight">HRP PLC<br />Online</h1>
            <p className="mt-1 text-[11px] leading-tight text-blue-100">ระบบชุมชนแห่งการเรียนรู้<br />ทางวิชาชีพ</p>
          </div>
        </div>

        <nav className="mt-9 space-y-2" aria-label="เมนูหลัก">
          {navItems.map((item) => (
            <button key={item.id} type="button" onClick={() => navigate(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-semibold transition ${activePage === item.id ? 'bg-white/18 text-white shadow-sm ring-1 ring-white/10' : 'text-blue-50 hover:bg-white/10'}`}>
              <Icon name={item.icon} className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/10 bg-white/10 p-4">
          <p className="text-sm font-bold">รายงาน PLC</p>
          <p className="mt-1 text-xs leading-5 text-blue-100">พิมพ์รายงานได้ตามจำนวนกิจกรรมที่บันทึก พร้อมรูปหลักฐานและส่วนลงนาม</p>
        </div>
      </aside>

      <main className="min-h-screen lg:ml-[270px]">
        <div className="mx-auto max-w-[1500px] px-4 pb-10 pt-20 sm:px-7 lg:px-8 lg:pt-8">
          <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
            <div className="flex items-center gap-3 self-start rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_8px_28px_rgba(15,23,42,0.06)] sm:self-auto">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">ส</div>
              <div>
                <p className="text-sm font-bold text-slate-900">คุณครูสุทธิดา</p>
                <p className="text-xs text-slate-500">ครูผู้ใช้งานระบบ</p>
              </div>
            </div>
          </header>

          {activePage === 'dashboard' ? (
            <>
              <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-r from-[#2d6eea] to-[#58a5f7] p-7 text-white shadow-[0_18px_40px_rgba(37,99,235,0.2)] sm:p-8">
                <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10" />
                <div className="absolute bottom-[-90px] right-40 h-48 w-48 rounded-full bg-blue-300/20" />
                <div className="relative max-w-3xl">
                  <h3 className="text-2xl font-extrabold sm:text-3xl">สวัสดี คุณครูสุทธิดา <span aria-hidden="true">👋</span></h3>
                  <p className="mt-2 text-sm leading-7 text-blue-50 sm:text-base">สร้างกลุ่ม PLC บันทึกกิจกรรมตามกระบวนการ 7 ขั้นตอน แนบรูปหลักฐาน และส่งออกรายงาน PDF ได้ในระบบเดียว</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" onClick={() => navigate('create')} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-blue-700 shadow-md transition hover:-translate-y-0.5">
                      <Icon name="plus" /> สร้างกลุ่ม PLC
                    </button>
                    <button type="button" onClick={() => navigate('activity')} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-blue-700 shadow-md transition hover:-translate-y-0.5">
                      <Icon name="note" /> บันทึกกิจกรรม
                    </button>
                  </div>
                </div>
              </section>

              <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {dashboardStats.map((item) => (
                  <article key={item.title} className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                    <div className={`grid h-12 w-12 place-items-center rounded-xl ${item.bg} ${item.color}`}><Icon name={item.icon} /></div>
                    <p className="mt-4 text-sm font-medium text-slate-500">{item.title}</p>
                    <p className="mt-1 text-3xl font-extrabold text-slate-950">{item.value}</p>
                  </article>
                ))}
              </section>

              <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
                <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-950">กลุ่ม PLC ล่าสุด</h3>
                      <p className="mt-1 text-sm text-slate-500">ติดตามความก้าวหน้าและส่งออกรายงาน</p>
                    </div>
                    <button type="button" onClick={() => navigate('groups')} className="text-sm font-bold text-blue-600 hover:text-blue-800">ดูทั้งหมด</button>
                  </div>
                  {localGroups.length ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {localGroups.slice(0, 4).map((group) => (
                        <button key={group.groupId} type="button" onClick={() => navigate('groups')} className="rounded-[18px] border border-violet-100 bg-violet-50/60 p-4 text-left transition hover:border-violet-300 hover:bg-violet-50">
                          <p className="font-bold text-slate-900">{group.groupName}</p>
                          <p className="mt-1 text-xs text-slate-500">ปีการศึกษา {group.academicYear} · ภาคเรียน {group.semester}</p>
                          <p className="mt-3 line-clamp-2 text-sm text-slate-600">{group.issue}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 grid min-h-60 place-items-center rounded-[20px] border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
                      <div>
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Icon name="users" className="h-7 w-7" /></div>
                        <p className="mt-4 font-bold text-slate-800">ยังไม่มีกลุ่ม PLC</p>
                        <p className="mt-1 text-sm text-slate-500">สร้างกลุ่มแรกเพื่อเริ่มบันทึกกิจกรรม</p>
                      </div>
                    </div>
                  )}
                </article>

                <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  <h3 className="text-xl font-extrabold text-slate-950">กระบวนการ PLC</h3>
                  <p className="mt-1 text-sm text-slate-500">หัวข้อที่จะปรากฏในรายงาน</p>
                  <ol className="mt-5 space-y-3">
                    {plcSteps.map((step, index) => (
                      <li key={step} className="flex items-center gap-3 text-sm text-slate-600">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-extrabold text-blue-700">{index + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  <button type="button" onClick={() => navigate('reports')} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800">ดูรูปแบบรายงาน <Icon name="arrow" className="h-4 w-4" /></button>
                </article>
              </section>
            </>
          ) : (
            <EmptyPage activePage={activePage} onNavigate={navigate} />
          )}
        </div>
      </main>
    </div>
  )
}

export default App
