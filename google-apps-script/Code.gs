const SHEET_NAMES = {
  GROUPS: 'groups',
  ACTIVITIES: 'activities',
  IMAGES: 'activity_images',
}

const HEADERS = {
  groups: [
    'group_id', 'group_name', 'academic_year', 'semester', 'issue',
    'owner_name', 'owner_email', 'status', 'created_at', 'updated_at',
  ],
  activities: [
    'activity_id', 'request_id', 'status', 'group_name', 'activity_no',
    'activity_date', 'start_time', 'end_time', 'hours', 'location',
    'plc_step', 'plc_step_name', 'title', 'objective', 'details', 'result',
    'problems', 'next_action', 'recorder', 'participant_count', 'participants',
    'created_at', 'updated_at',
  ],
  activity_images: [
    'image_id', 'activity_id', 'drive_file_id', 'file_name', 'mime_type',
    'caption', 'sort_order', 'drive_url', 'created_at',
  ],
}

const REQUIRED_ACTIVITY_FIELDS = [
  'groupName', 'activityNo', 'activityDate', 'startTime', 'endTime', 'hours',
  'plcStep', 'title', 'objective', 'details', 'result', 'nextAction',
  'recorder', 'participantCount', 'participants',
]

function setupProject() {
  const properties = PropertiesService.getScriptProperties()
  let spreadsheetId = properties.getProperty('SPREADSHEET_ID')
  let rootFolderId = properties.getProperty('ROOT_FOLDER_ID')

  if (!spreadsheetId) {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create('HRP PLC Database')
    spreadsheetId = spreadsheet.getId()
    properties.setProperty('SPREADSHEET_ID', spreadsheetId)
  }

  if (!rootFolderId) {
    const folder = DriveApp.createFolder('HRP PLC Uploads')
    rootFolderId = folder.getId()
    properties.setProperty('ROOT_FOLDER_ID', rootFolderId)
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId)
  Object.keys(HEADERS).forEach((sheetName) => ensureSheet_(spreadsheet, sheetName, HEADERS[sheetName]))

  const defaultSheet = spreadsheet.getSheetByName('Sheet1')
  if (defaultSheet && spreadsheet.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    spreadsheet.deleteSheet(defaultSheet)
  }

  const result = {
    spreadsheetId,
    spreadsheetUrl: spreadsheet.getUrl(),
    rootFolderId,
    rootFolderUrl: `https://drive.google.com/drive/folders/${rootFolderId}`,
    googleAuthConfigured: Boolean(properties.getProperty('GOOGLE_CLIENT_ID') && properties.getProperty('ALLOWED_EMAILS')),
  }
  console.log(JSON.stringify(result, null, 2))
  return result
}

function doGet() {
  try {
    const config = getConfig_()
    return json_({ ok: true, service: 'HRP PLC API', configured: Boolean(config.spreadsheetId && config.rootFolderId) })
  } catch (error) {
    return json_({ ok: false, message: error.message })
  }
}

function doPost(event) {
  try {
    if (!event || !event.postData || !event.postData.contents) {
      throw new Error('ไม่พบข้อมูลที่ส่งมา')
    }

    const payload = JSON.parse(event.postData.contents)
    const config = getConfig_()
    const user = verifyGoogleUser_(payload.idToken, config)
    if (payload.action === 'checkAccess') return json_({ ok: true, user })
    if (payload.action === 'saveActivity') return json_(saveActivity_(payload))
    if (payload.action === 'listActivities') return json_(listActivities_(payload.includeImages === true))
    if (payload.action === 'getActivity') return json_(getActivity_(payload.activityId))
    throw new Error('ไม่รองรับคำสั่งนี้')
  } catch (error) {
    console.error(error.stack || error)
    return json_({ ok: false, message: error.message || 'เกิดข้อผิดพลาดในระบบ' })
  }
}

function verifyGoogleUser_(idToken, config) {
  if (!config.googleClientId || !config.allowedEmails.length) {
    throw new Error('ยังไม่ได้ตั้งค่า Google Login ใน Script Properties')
  }
  if (!idToken) throw new Error('กรุณาเข้าสู่ระบบด้วย Google')

  const response = UrlFetchApp.fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
    method: 'get',
    muteHttpExceptions: true,
  })
  if (response.getResponseCode() !== 200) throw new Error('เซสชัน Google ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่')

  const identity = JSON.parse(response.getContentText())
  const validIssuer = identity.iss === 'accounts.google.com' || identity.iss === 'https://accounts.google.com'
  const emailVerified = identity.email_verified === true || identity.email_verified === 'true'
  const unexpired = Number(identity.exp) * 1000 > Date.now()
  const email = clean_(identity.email).toLowerCase()

  if (identity.aud !== config.googleClientId || !validIssuer || !emailVerified || !unexpired) {
    throw new Error('ไม่สามารถยืนยันบัญชี Google ได้')
  }
  if (!config.allowedEmails.includes(email)) {
    throw new Error(`บัญชี ${email} ไม่มีสิทธิ์ใช้งานระบบ`)
  }

  return { id: identity.sub, email, name: clean_(identity.name) }
}

function checkGoogleAuthSetup() {
  const config = getConfig_()
  const result = {
    configured: Boolean(config.googleClientId && config.allowedEmails.length),
    allowedUserCount: config.allowedEmails.length,
  }
  console.log(JSON.stringify(result, null, 2))
  return result
}

function listActivities_(includeImages, activityId) {
  const config = getConfig_()
  if (!config.spreadsheetId) {
    throw new Error('ยังไม่ได้ตั้งค่าระบบ กรุณารัน setupProject() ก่อน Deploy')
  }

  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId)
  const sheet = ensureSheet_(spreadsheet, SHEET_NAMES.ACTIVITIES, HEADERS.activities)
  if (sheet.getLastRow() < 2) return { ok: true, activities: [] }

  const imagesSheet = ensureSheet_(spreadsheet, SHEET_NAMES.IMAGES, HEADERS.activity_images)
  const imagesByActivity = {}
  if (imagesSheet.getLastRow() >= 2) {
    const imageRows = imagesSheet.getRange(2, 1, imagesSheet.getLastRow() - 1, HEADERS.activity_images.length).getValues()
    imageRows.forEach((row) => {
      const rowActivityId = clean_(row[1])
      if (activityId && rowActivityId !== activityId) return
      if (!imagesByActivity[rowActivityId]) imagesByActivity[rowActivityId] = []
      const driveFileId = clean_(row[2])
      imagesByActivity[rowActivityId].push({
        fileName: clean_(row[3]),
        caption: clean_(row[5]),
        sortOrder: Number(row[6]) || 0,
        url: includeImages ? getReportImageDataUrl_(driveFileId) : `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1200`,
      })
    })
  }

  let rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.activities.length).getValues()
  if (activityId) rows = rows.filter((row) => clean_(row[0]) === activityId)
  const activities = rows.map((row) => ({
    activityId: clean_(row[0]),
    requestId: clean_(row[1]),
    status: clean_(row[2]),
    groupName: clean_(row[3]),
    activityNo: row[4],
    activityDate: formatDateValue_(row[5]),
    startTime: formatTimeValue_(row[6]),
    endTime: formatTimeValue_(row[7]),
    hours: row[8],
    location: clean_(row[9]),
    plcStep: row[10],
    plcStepName: clean_(row[11]),
    title: clean_(row[12]),
    objective: clean_(row[13]),
    details: clean_(row[14]),
    result: clean_(row[15]),
    problems: clean_(row[16]),
    nextAction: clean_(row[17]),
    recorder: clean_(row[18]),
    participantCount: row[19],
    participants: clean_(row[20]),
    createdAt: formatDateTimeValue_(row[21]),
    updatedAt: formatDateTimeValue_(row[22]),
    images: (imagesByActivity[clean_(row[0])] || []).sort((a, b) => a.sortOrder - b.sortOrder),
  })).sort((a, b) => String(b.activityDate).localeCompare(String(a.activityDate)) || Number(b.activityNo) - Number(a.activityNo))

  return { ok: true, activities }
}

function getActivity_(activityId) {
  if (!clean_(activityId)) throw new Error('ไม่พบรหัสกิจกรรม')
  const result = listActivities_(true, clean_(activityId))
  if (!result.activities.length) throw new Error('ไม่พบกิจกรรมที่ต้องการ')
  return { ok: true, activity: result.activities[0] }
}

function getReportImageDataUrl_(fileId) {
  try {
    const blob = DriveApp.getFileById(fileId).getBlob()
    return `data:${blob.getContentType()};base64,${Utilities.base64Encode(blob.getBytes())}`
  } catch (error) {
    console.error(`โหลดรูป ${fileId} ไม่สำเร็จ: ${error.message}`)
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`
  }
}

function saveActivity_(payload) {
  const config = getConfig_()
  if (!config.spreadsheetId || !config.rootFolderId) {
    throw new Error('ยังไม่ได้ตั้งค่าระบบ กรุณารัน setupProject() ก่อน Deploy')
  }

  const activity = payload.activity || {}
  if (payload.status !== 'draft') {
    REQUIRED_ACTIVITY_FIELDS.forEach((field) => {
      if (activity[field] === undefined || activity[field] === null || String(activity[field]).trim() === '') {
        throw new Error(`ข้อมูลไม่ครบ: ${field}`)
      }
    })
  }

  const images = Array.isArray(payload.images) ? payload.images : []
  if (images.length > 8) throw new Error('อัปโหลดรูปได้ไม่เกิน 8 รูปต่อกิจกรรม')

  const lock = LockService.getScriptLock()
  if (!lock.tryLock(30000)) throw new Error('ระบบกำลังบันทึกข้อมูลอื่นอยู่ กรุณาลองอีกครั้ง')

  const createdFiles = []
  try {
    const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId)
    const activitiesSheet = ensureSheet_(spreadsheet, SHEET_NAMES.ACTIVITIES, HEADERS.activities)
    const imagesSheet = ensureSheet_(spreadsheet, SHEET_NAMES.IMAGES, HEADERS.activity_images)
    const now = new Date().toISOString()
    const existingRow = payload.activityId ? findRow_(activitiesSheet, 1, payload.activityId) : 0
    const activityId = existingRow ? payload.activityId : Utilities.getUuid()
    const createdAt = existingRow ? activitiesSheet.getRange(existingRow, 22).getValue() : now
    const stepNumber = activity.plcStep ? Number(activity.plcStep) : ''
    const stepName = stepNumber ? getStepName_(stepNumber) : ''
    const activityRow = [
      activityId,
      payload.requestId || Utilities.getUuid(),
      payload.status === 'draft' ? 'draft' : 'submitted',
      clean_(activity.groupName),
      Number(activity.activityNo),
      clean_(activity.activityDate),
      clean_(activity.startTime),
      clean_(activity.endTime),
      Number(activity.hours),
      clean_(activity.location),
      stepNumber,
      stepName,
      clean_(activity.title),
      clean_(activity.objective),
      clean_(activity.details),
      clean_(activity.result),
      clean_(activity.problems),
      clean_(activity.nextAction),
      clean_(activity.recorder),
      Number(activity.participantCount),
      clean_(activity.participants),
      createdAt,
      now,
    ]

    const activityFolder = getActivityFolder_(config.rootFolderId, activity.groupName, activityId)
    const imageRows = images.map((image, index) => {
      validateImage_(image)
      const bytes = Utilities.base64Decode(image.base64)
      const blob = Utilities.newBlob(bytes, image.mimeType, safeFileName_(image.fileName, index + 1))
      const driveFile = activityFolder.createFile(blob)
      driveFile.setDescription(`HRP PLC | ${activityId} | ${clean_(image.caption)}`)
      createdFiles.push(driveFile)
      return [
        Utilities.getUuid(),
        activityId,
        driveFile.getId(),
        driveFile.getName(),
        image.mimeType,
        clean_(image.caption),
        Number(image.sortOrder || index + 1),
        driveFile.getUrl(),
        now,
      ]
    })

    if (existingRow) {
      activitiesSheet.getRange(existingRow, 1, 1, activityRow.length).setValues([activityRow])
    } else {
      activitiesSheet.appendRow(activityRow)
    }

    if (imageRows.length) {
      imagesSheet.getRange(imagesSheet.getLastRow() + 1, 1, imageRows.length, HEADERS.activity_images.length).setValues(imageRows)
    }

    return {
      ok: true,
      activityId,
      status: activityRow[2],
      uploadedImages: imageRows.length,
      message: activityRow[2] === 'draft' ? 'บันทึกร่างเรียบร้อยแล้ว' : 'บันทึกกิจกรรมเรียบร้อยแล้ว',
    }
  } catch (error) {
    createdFiles.forEach((file) => {
      try { file.setTrashed(true) } catch (cleanupError) { console.error(cleanupError) }
    })
    throw error
  } finally {
    lock.releaseLock()
  }
}

function getConfig_() {
  const properties = PropertiesService.getScriptProperties()
  return {
    spreadsheetId: properties.getProperty('SPREADSHEET_ID'),
    rootFolderId: properties.getProperty('ROOT_FOLDER_ID'),
    googleClientId: clean_(properties.getProperty('GOOGLE_CLIENT_ID')),
    allowedEmails: clean_(properties.getProperty('ALLOWED_EMAILS')).split(',').map((email) => email.trim().toLowerCase()).filter(Boolean),
  }
}

function ensureSheet_(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName)
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName)
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    sheet.setFrozenRows(1)
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#dbeafe')
    sheet.autoResizeColumns(1, headers.length)
  }
  return sheet
}

function findRow_(sheet, column, value) {
  if (!value || sheet.getLastRow() < 2) return 0
  const match = sheet.getRange(2, column, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(value))
    .matchEntireCell(true)
    .findNext()
  return match ? match.getRow() : 0
}

function getActivityFolder_(rootFolderId, groupName, activityId) {
  const rootFolder = DriveApp.getFolderById(rootFolderId)
  const groupFolder = getOrCreateFolder_(rootFolder, safeFolderName_(groupName))
  return getOrCreateFolder_(groupFolder, activityId)
}

function getOrCreateFolder_(parent, name) {
  const folders = parent.getFoldersByName(name)
  return folders.hasNext() ? folders.next() : parent.createFolder(name)
}

function validateImage_(image) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!image || !allowedTypes.includes(image.mimeType)) throw new Error('รองรับเฉพาะไฟล์ JPG, PNG และ WebP')
  if (!image.base64 || image.base64.length > 12 * 1024 * 1024) throw new Error('ข้อมูลรูปภาพมีขนาดใหญ่เกินกำหนด')
}

function getStepName_(step) {
  const steps = [
    'สร้างกลุ่มและกำหนดสมาชิก',
    'ระบุปัญหาและเป้าหมาย',
    'วิเคราะห์สาเหตุของปัญหา',
    'ออกแบบแนวทางแก้ไข',
    'นำแนวทางไปใช้',
    'สะท้อนผลและแลกเปลี่ยนเรียนรู้',
    'สรุปผลและจัดทำรายงาน',
  ]
  if (step < 1 || step > steps.length) throw new Error('ขั้นตอน PLC ไม่ถูกต้อง')
  return steps[step - 1]
}

function safeFolderName_(value) {
  return clean_(value).replace(/[\\/:*?"<>|#%{}~]/g, '-').slice(0, 100) || 'ไม่ระบุชื่อกลุ่ม'
}

function safeFileName_(value, index) {
  const cleaned = clean_(value).replace(/[\\/:*?"<>|#%{}~]/g, '-').slice(0, 120)
  return cleaned || `image-${index}.webp`
}

function clean_(value) {
  return value === undefined || value === null ? '' : String(value).trim()
}

function formatDateValue_(value) {
  return value instanceof Date ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd') : clean_(value)
}

function formatTimeValue_(value) {
  return value instanceof Date ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm') : clean_(value)
}

function formatDateTimeValue_(value) {
  return value instanceof Date ? value.toISOString() : clean_(value)
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)
}
