# HRP PLC Online

ระบบบันทึกกิจกรรม PLC ด้วย React/Vite โดยใช้ Google Sheet เก็บข้อมูลข้อความ และ Google Drive เก็บรูปภาพหลักฐาน ผ่าน Google Apps Script Web App

## โครงสร้างการบันทึก

- ชีต `activities` เก็บข้อมูลกิจกรรม เวลา ขั้นตอน PLC เนื้อหา และผู้เข้าร่วม
- ชีต `activity_images` เก็บ Drive File ID และคำบรรยายภาพ
- ชีต `groups` เตรียมไว้สำหรับหน้าสร้างกลุ่ม PLC
- โฟลเดอร์ `HRP PLC Uploads` เก็บรูปแยกตามชื่อกลุ่มและ Activity ID
- รูปจะถูกย่อด้านยาวไม่เกิน 1,600 px และแปลงเป็น WebP ก่อนอัปโหลด

## 1. สร้าง Google Apps Script

1. เปิด Google Sheet ที่ต้องการใช้เป็นฐานข้อมูล
2. เลือก `ส่วนขยาย (Extensions)` > `Apps Script`
3. ตั้งชื่อโปรเจกต์ว่า `HRP PLC API`
4. เปิดไฟล์ `Code.gs` ใน Apps Script
5. คัดลอกโค้ดทั้งหมดจาก `google-apps-script/Code.gs` ในโปรเจกต์นี้ไปวาง
6. กด Save
7. เลือกฟังก์ชัน `setupProject` จากแถบด้านบน แล้วกด Run
8. อนุญาตสิทธิ์เข้าถึง Google Sheet และ Google Drive
9. เปิด `Executions` หรือ Execution log แล้วเก็บค่า:
   - `spreadsheetUrl`
   - `rootFolderUrl`
   - `appKey`

ถ้าเปิด Apps Script จากใน Google Sheet ระบบจะใช้ชีตที่เปิดอยู่และสร้างแท็บฐานข้อมูลภายในไฟล์นั้น หากเป็น Apps Script แบบ standalone ระบบจึงจะสร้าง Google Sheet ชื่อ `HRP PLC Database` ใหม่ ส่วนโฟลเดอร์ Drive ชื่อ `HRP PLC Uploads` จะถูกสร้างให้อัตโนมัติ

## 2. Deploy เป็น Web App

1. ใน Apps Script เลือก `Deploy` > `New deployment`
2. เลือกประเภท `Web app`
3. ตั้ง `Execute as` เป็น `Me`
4. ตั้ง `Who has access` เป็น `Anyone`
5. กด Deploy แล้วคัดลอก URL ที่ลงท้ายด้วย `/exec`

ทุกครั้งที่แก้ `Code.gs` ต้องเลือก `Deploy` > `Manage deployments` > `Edit` > `New version` แล้ว Deploy ใหม่

## 3. เชื่อมเว็บไซต์

สร้างไฟล์ `.env.local` ที่รากโปรเจกต์ โดยใช้รูปแบบ:

```env
VITE_GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
VITE_GOOGLE_APPS_SCRIPT_KEY=APP_KEY_FROM_SETUP_PROJECT
```

จากนั้นปิดและเปิด dev server ใหม่:

```powershell
npm.cmd run dev
```

## 4. ทดสอบ

1. เปิดเมนู `บันทึกกิจกรรม`
2. กด `เริ่มบันทึกกิจกรรม`
3. กรอกข้อมูลและเลือกรูป
4. กด `บันทึกร่าง` หรือ `บันทึกกิจกรรม`
5. ตรวจแถวใหม่ในชีต `activities`
6. ตรวจรูปใน `HRP PLC Uploads` และข้อมูลรูปในชีต `activity_images`

## ความปลอดภัย

App Key ช่วยป้องกันการเรียก API โดยไม่ทราบค่า แต่ไม่ใช่ข้อมูลลับที่ซ่อนได้อย่างสมบูรณ์ เพราะค่าที่ใช้สร้างเว็บ Vite สามารถตรวจดูได้จากเบราว์เซอร์ ระบบรุ่นนี้จึงเหมาะสำหรับใช้งานภายในกลุ่มที่ไว้ใจกัน ไม่ควรใช้เก็บข้อมูลอ่อนไหวหรือเผยแพร่ App Key ในเอกสารสาธารณะ

ไฟล์ใน Drive จะไม่ถูกตั้งเป็นสาธารณะโดยสคริปต์นี้ และยังคงใช้สิทธิ์ของเจ้าของโฟลเดอร์

## คำสั่งตรวจสอบโปรเจกต์

```powershell
npm.cmd run lint
npm.cmd run build
```
