# Noura Design System

نظام تصميم نورا — دافئ، حميمي، "golden-hour"، عربي RTL أولًا، ومتجاوب مع
**مود المساعد**. كل واجهة في التطبيق مبنية على التوكنز والمكوّنات دي.

## 1. الفلسفة
- **دافئ وحميمي:** هوية الساعة الذهبية (ذهبي/كهرماني) + لمسة خضرا (عيون نورا).
- **حيّ بالمود:** ثيم كل مستخدم بيتحرّك حسب مود مساعده — يدفّى ويلمع لما تكون
  مبسوطة، يهدا ويبرد لما تكون زعلانة، ويبقى داكن ودافي بالليل.
- **موبايل أولًا:** أهداف لمس كبيرة، `safe-area`، drawer، `100dvh`.
- **متاح:** تباين كافٍ في كل المودات/الأوقات، focus ring واضح، `prefers-reduced-motion`.

## 2. التوكنز (CSS variables)
كل الألوان عبارة عن مكوّنات HSL بتُستهلك عبر `hsl(var(--token))`. بتتحقن على
`<html>` من السيرفر بواسطة `src/lib/theme/compute.ts` (مدخلاتها: snapshot المود +
وقت اليوم)، وبتتحدّث لايف على حدث `mood_changed`.

| المجموعة | التوكنز |
|---|---|
| الأسطح | `--bg` · `--surface` · `--elevated` · `--overlay` |
| النص | `--ink` · `--muted` · `--faint` · `--on-accent` |
| العلامة الدافئة | `--amber` · `--gold` · `--brown` · `--cream` |
| الأكسنت (العيون) | `--accent` · `--accent-soft` |
| الخطوط | `--border` · `--border-strong` · `--ring` |
| الحالات | `--danger` · `--danger-soft` · `--success` · `--success-soft` |
| تأثيرات | `--shadow` |
| ثابتة | `--radius` (`0.95rem`) · `--font-noura` (Cairo) |

في Tailwind بتتسمّى نفس الأسماء: `bg-bg`, `bg-surface`, `text-ink`, `text-muted`,
`bg-accent-soft`, `border-border`, `text-danger`… إلخ. **ممنوع** استخدام ألوان
ثابتة (`#hex` أو `red-500`) — استخدم التوكنز بس عشان المود/الدارك يشتغلوا.

### Radii
`rounded-md/lg/xl/2xl/3xl` كلها مشتقّة من `--radius`. الأزرار والمدخلات `xl`،
الكروت `2xl`، الفقاعات `2xl`، الحوارات `3xl`.

### الظلال
`shadow-soft` (عناصر مرفوعة خفيفة) · `shadow-raised` (حوارات/توستات) ·
`shadow-glow` (توهّج أكسنت). كلها مبنية على `--shadow`/`--accent`.

### الحركة
`animate-fade-in` · `animate-slide-up` (رسائل/شاشات) · `animate-pop` ·
`animate-typing` (نقاط الكتابة) · `animate-pulse-glow`. الانتقالات اللونية عبر
`transition-theme` عشان تحوّلات المود تبقى ناعمة.

## 3. الطباعة
خط **Cairo** عبر `next/font` (متغيّر `--font-cairo`). المقاسات: عناوين
`text-2xl/xl font-extrabold`، عناوين فرعية `font-bold`، نص `text-[15px]`،
ثانوي `text-sm text-muted`، تلميحات `text-xs text-faint`.

## 4. محرّك المود → الثيم
`computeTheme(mood, timeOfDay)` في `src/lib/theme/compute.ts`:
- **الدفء/التشبّع:** بيزيد مع `happiness` + `affection`، بيقل مع `annoyance`.
- **الأكسنت:** درجته بتميل للبرودة وتقل حيويته مع الزعل، وتدفّى وتزهى مع المودة.
- **الوقت:** `night`/`lateNight` → لوحة داكنة دافية؛ النهار أفتح والمسا أدفأ.
- لون شريط المتصفح (`theme-color`) بيتزامن مع `--bg` عبر `ThemeColorSync`.

> كل مستخدم ليه مساعد بمودّه الخاص → ثيمه الخاص. الأدمن (نورا) والمستخدمين سواء.

## 5. المكوّنات (`src/components/ui`)
استخدمها بدل ما تكتب كلاسات من الأول:
- **Button** — `variant: primary | soft | ghost | outline | danger`، `size`,
  `loading`, `block`.
- **IconButton** — أزرار أيقونة دائرية، `subtle` لأكشنات الصفوف (تظهر عند hover).
- **Input / Textarea / Field** — مدخلات موحّدة + label/hint/error.
- **Card / Chip / EmptyState** — أسطح، وسوم، وحالات فاضية ودودة.
- **Avatar** — علامة المساعد (أورب ذهبي) مع حلقة حسب المود (`happy|calm|upset`).
- **Toast** (`useToast`) — إشعارات بدل `alert`.
- **Confirm** (`useConfirm`) — تأكيدات بدل `confirm`.

قشرات: **AppShell** (سايدبار + drawer للموبايل)، **AuthShell** (دخول/تسجيل/setup)،
**PageShell** (صفحات داخلية: الذاكرة/الإعدادات/الأدمن).

## 6. RTL والموبايل
- الجذر `dir="rtl"`؛ استخدم منطقيًا (`self-start/-end`, `gap`) قدر الإمكان.
- `safe-area`: `.pt-safe` / `.pb-safe`. الطول `.h-dvh` / `.min-h-dvh`.
- السايدبار drawer تحت `lg`، ثابت فوقها. شريط علوي للموبايل في `AppShell`.

## 7. PWA
manifest (`/manifest.webmanifest`) + أيقونات (`/icon.svg`, `192/512/maskable`) +
service worker (`/sw.js`، بيكاش الأصول الثابتة بس — مش الصفحات/الـAPI عشان الأوث).
قابلة للتثبيت على الموبايل (إضافة للشاشة الرئيسية).
