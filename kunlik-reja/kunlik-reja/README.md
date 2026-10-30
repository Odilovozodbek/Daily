# Kunlik Reja

Vazifalarni vaqt bo'yicha rejalashtirish ilovasi. HTML, CSS va JavaScript, qo'shimcha kutubxonasiz va internetsiz ishlaydi.

## Papka tuzilishi

```
kunlik-reja/
├── README.md                  shu qo'llanma
├── package.json               APK yasash uchun (Capacitor)
├── capacitor.config.json      APK sozlamalari (ilova nomi, id)
└── www/                       ilovaning o'zi
    ├── index.html             sahifa tuzilishi (HTML) va ikonkalar to'plami
    ├── css/style.css          dizayn, ranglar, kun/tun rejimi (CSS)
    ├── js/app.js              barcha mantiq (JavaScript)
    ├── manifest.json          ilova nomi va ikonkalari
    ├── sw.js                  oflayn ishlash (brauzerda ochilganda)
    └── img/
        ├── logo.svg, favicon.svg
        ├── hero.svg           yuqori qismdagi rasm
        ├── empty.svg          reja bo'sh bo'lganda rasm
        └── icon-192.png, icon-512.png, icon-maskable-512.png   ilova ikonkalari
```

## Kompyuterda ochish

`www/index.html` faylini brauzerda oching. Ma'lumotlar brauzer xotirasida (localStorage) saqlanadi.

## APK yasash (Capacitor orqali)

Kerak bo'ladi: [Node.js](https://nodejs.org) va [Android Studio](https://developer.android.com/studio).

Shu papkaning ichida terminalda:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync
npx cap open android
```

Android Studio ochilgach (birinchi marta Gradle yuklab olishi uchun biroz kuting):

1. Yuqori menyuda **Build → Build Bundle(s) / APK(s) → Build APK(s)** ni bosing.
2. Tayyor fayl `android/app/build/outputs/apk/debug/app-debug.apk` ichida bo'ladi. Uni telefonga ko'chirib o'rnating.
3. Ilova ikonkasini almashtirish: `app` papkasini o'ng tugma bilan bosing, **New → Image Asset**, manba sifatida `www/img/icon-512.png` ni tanlang.

`www/` ichidagi fayllarni o'zgartirgach, APK ni yangilash uchun `npx cap sync` ni qaytadan ishga tushiring.

## Eslatmalar haqida

Sahifa ochiq turganda vazifa vaqti kelsa, ekranda xabar chiqadi, "Eslatma" yoqilgan bo'lsa signal ham beriladi. Telefon yopiq yoki ilova fonda bo'lganda ham eslatma kerak bo'lsa, `@capacitor/local-notifications` plaginini qo'shish kerak. Bu keyingi qadam, kerak bo'lsa qo'shib beraman.

## Kodni o'rganish uchun

- `js/app.js` ning boshida bo'limlar ro'yxati bor. Har bir funksiya ustida o'zbekcha izoh yozilgan.
- Vazifa turini qo'shish: `index.html` dagi `.cats` ichiga yangi `label`, `js/app.js` dagi `CATS` ga yangi qator va `css/style.css` dagi `--c-...` / `--s-...` ranglar.
- Ranglarni o'zgartirish: `css/style.css` boshidagi `:root` bloki (kun rejimi) va uning pastidagi tun rejimi bloklari.
