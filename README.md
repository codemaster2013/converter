<div align="center">

<img src="icon-512.png" alt="MediaGrabber Pro logo" width="120">

# MediaGrabber Pro

### Free PDF & image tools that run 100% in your browser

**No uploads · No sign-up · No server · Your files never leave your device**

<br>

[![Live Site](https://img.shields.io/badge/🌐_Live_Site-Open_App-7c3aed?style=for-the-badge)](https://codemaster2013.github.io/converter/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5a0fc8?style=for-the-badge&logo=pwa&logoColor=white)](https://codemaster2013.github.io/converter/)
[![Privacy](https://img.shields.io/badge/Privacy-100%25_Local-22c55e?style=for-the-badge&logo=shield&logoColor=white)](#-privacy)

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0?style=flat-square&logo=webassembly&logoColor=white)
![Offline](https://img.shields.io/badge/Works-Offline-0ea5e9?style=flat-square)
![Tools](https://img.shields.io/badge/Tools-19+-f97316?style=flat-square)

<br>

<img src="screenshot-desktop.png" alt="MediaGrabber Pro on desktop" width="85%">

</div>

<br>

## ✨ Why MediaGrabber Pro?

| 🔒 Private | ⚡ Fast | 📴 Offline | 📱 Installable |
| :---: | :---: | :---: | :---: |
| Everything happens on your device | No waiting for uploads or downloads | Works without internet after first visit | Add it to your phone or desktop like an app |

<br>

## 🧰 All Tools

### 📄 PDF Tools

| Tool | What it does |
| --- | --- |
| 🖼️ **Image to PDF / JPG to PDF** | Turn photos and images into one PDF |
| 🔗 **Merge PDF** | Combine many PDFs into one |
| 🗂️ **PDF Page Organizer** | Rotate, reorder, delete and split pages |
| ✍️ **Sign PDF** | Draw your signature and place it on a document |
| 🔓 **Unlock PDF** | Remove a password you already know |
| 🔐 **PDF Locker** | Add a password to a PDF |
| 📖 **PDF Reader** | Read and annotate PDFs |
| 🔄 **PDF Converter** | Word, PowerPoint, image and text to PDF, and back |
| 📷 **Document Scanner** | Camera straight to PDF |

### 🖼️ Image Tools

| Tool | What it does |
| --- | --- |
| 🔁 **Image Converter** | Convert between JPG, PNG and WebP |
| 🍎 **HEIC to JPG** | Open iPhone photos anywhere |
| 📉 **Compress to Size** | Hit an exact 100 KB, 50 KB or 20 KB target |
| 🪪 **Photo & Signature Resizer** | Exact pixels and KB for online forms |
| ✂️ **Remove Background** | Cut out the subject of a photo |
| 📍 **Remove EXIF / GPS** | Strip location data before sharing |
| 🔤 **Smart OCR** | Image to text, English and Hindi |

### 🧩 Utilities

| Tool | What it does |
| --- | --- |
| ▦ **QR Code Generator** | Make QR codes, no sign-up |
| 📸 **QR Code Scanner** | Scan with the camera or from an image |
| 🧬 **Base64 Converter** | Image to Base64 and back |

<br>

## 📱 App Experience

<table>
<tr>
<td width="50%" valign="top">

- 📲 Installable **PWA**
- 📴 **Offline** support
- 📤 **Share target**: send files from your phone's share sheet
- 🔗 Deep links to each tool (e.g. `?tool=ocr`)

</td>
<td width="50%" valign="top">

- 🌗 **Light and dark** mode
- 🎨 **16 app icon themes**: Classic, Forest, Space, Galaxy, Fire, Marble, Glow, Fur and more
- 🎬 Animated intro

</td>
</tr>
</table>

<div align="center">

| Light mode | Dark mode | Phone |
| :---: | :---: | :---: |
| <img src="light%20mode.png" alt="Light mode" width="260"> | <img src="dark%20mode.png" alt="Dark mode" width="260"> | <img src="screenshot-phone.png" alt="Phone view" width="140"> |

</div>

<br>

## 🛠️ Built With

Plain **HTML, CSS and JavaScript**. No framework, no build step. Libraries are bundled locally so everything works offline.

| Purpose | Library |
| --- | --- |
| PDF create / edit | pdf-lib, jsPDF |
| PDF rendering | PDF.js |
| OCR | Tesseract.js (English + Hindi data included) |
| HEIC conversion | heic2any |
| QR codes | qrcode, jsQR |
| ZIP handling | JSZip |
| Intro effects | three.js |
| Feedback / VIP pages | Firebase |

<br>

## 📁 Project Structure

<details>
<summary><b>Click to expand</b></summary>

```text
converter/
├── index.html              # Main app
├── *.html                  # Landing page per tool (jpg-to-pdf, merge-pdf, ...)
├── index (2..5).html       # Feedback, VIP and beta pages
├── tools.js                # Extra tools (compress, scanner, sign, EXIF, QR scan, ...)
├── pwa.js · sw.js          # PWA install logic and service worker
├── mg-*.js                 # Intro, deep links, icons, library loader
├── lib-*.js                # Bundled third-party libraries
├── *.traineddata.gz        # OCR language data (English, Hindi)
├── appicon-*               # Icon theme packs
├── manifest.webmanifest    # PWA manifest
├── sitemap.xml · robots.txt
└── 404.html · offline.html
```

</details>

<br>

## 🚀 Run Locally

Service workers and camera access need a server, so don't just double-click the file.

```bash
git clone https://github.com/codemaster2013/converter.git
cd converter
python3 -m http.server 8080
```

Then open **http://localhost:8080**

<br>

## 🌍 Deploy

Works on GitHub Pages, Vercel, Netlify or any static host.

**GitHub Pages:** Settings → Pages → Deploy from branch → `main` / root

> [!IMPORTANT]
> After changing any file, bump `CACHE_VERSION` at the top of `sw.js` so returning users get the update instead of a cached copy.

<br>

## 🔒 Privacy

All conversion, OCR, compression and editing happens **locally in your browser** using JavaScript and WebAssembly. Your files are never sent to a server.

<br>

## 🐞 Feedback

Found a bug or have an idea? [Open an issue](../../issues).

<br>

<div align="center">

**Made with ❤️ by [codemaster2013](https://github.com/codemaster2013)**

⭐ If you like the app, star the repo!

</div>
