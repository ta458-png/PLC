const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
const AUTH_STORAGE_KEY = 'hrp-plc-google-auth'

let googleScriptPromise

function decodeCredential(credential) {
  try {
    const payload = credential.split('.')[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

function readStoredAuth() {
  try {
    return JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

export function isGoogleLoginConfigured() {
  return Boolean(GOOGLE_CLIENT_ID)
}

export function getGoogleClientId() {
  return GOOGLE_CLIENT_ID
}

export function getGoogleUser() {
  const auth = readStoredAuth()
  if (!auth?.credential || !auth?.user || Number(auth.user.exp) * 1000 <= Date.now()) {
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
  return auth.user
}

export function getGoogleIdToken() {
  return getGoogleUser() ? readStoredAuth()?.credential || '' : ''
}

export function saveGoogleCredential(credential) {
  const identity = decodeCredential(credential)
  if (!identity || identity.aud !== GOOGLE_CLIENT_ID || Number(identity.exp) * 1000 <= Date.now()) {
    throw new Error('ไม่สามารถยืนยันข้อมูลบัญชี Google ได้ กรุณาลองเข้าสู่ระบบใหม่')
  }

  const user = {
    id: identity.sub,
    name: identity.name || identity.email || 'ผู้ใช้งาน',
    email: identity.email || '',
    picture: identity.picture || '',
    exp: identity.exp,
  }
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ credential, user }))
  return user
}

export function clearGoogleAuth() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY)
  window.google?.accounts?.id?.disableAutoSelect()
}

export function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (googleScriptPromise) return googleScriptPromise

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity-services]')
    const script = existing || document.createElement('script')
    const handleLoad = () => resolve(window.google)
    const handleError = () => reject(new Error('โหลดระบบ Google Login ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'))

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
    if (!existing) {
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.dataset.googleIdentityServices = 'true'
      document.head.appendChild(script)
    }
  }).catch((error) => {
    googleScriptPromise = null
    throw error
  })

  return googleScriptPromise
}
