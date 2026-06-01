# نورا — Local POC (أوفلاين على الموبايل)

تطبيق React Native صغير بيكلّم **نورا محلي بالكامل على الجهاز** (Gemma 3 4B عبر `llama.rn`)، من غير أي نت ولا سيرفر. الشخصية هي **نفس شخصية نورا** اللي في موقع الويب (متنقولة في `src/persona/noura.ts`).

> ⚠️ ده Proof of Concept للتأكد إن اللوب كامل (موديل + شخصية + شات) شغّال على الـS25 Ultra. لسه **من غير ذاكرة ولا مزاج متغيّر ولا DB sync** — دول الخطوة اللي بعدها لو الإحساس عجبك.

---

## اللي محتاجه على جهاز التطوير (مش الموبايل)
- **Node 18+** و **JDK 17**
- **Android Studio** + Android SDK + NDK (من Android Studio → SDK Manager → SDK Tools → NDK)
- موبايل **S25 Ultra** موصول بالكابل و **USB debugging** مفعّل

## ملف الموديل (تنزّله مرة واحدة)
نزّل نسخة GGUF مضغوطة من Gemma 3 4B Instruct، مثلاً:
- `gemma-3-4b-it-Q4_K_M.gguf` (~٢.٥ جيجا) من Hugging Face (ابحث عن "gemma-3-4b-it GGUF").

سيبه على جهازك دلوقتي — التطبيق هيخليك تختاره من الموبايل أول مرة وينسخه جواه.

---

## خطوات البناء والتشغيل

```bash
# 1) اعمل مشروع RN فاضي (مرة واحدة) جنب الفولدر ده
npx @react-native-community/cli@latest init NouraLocal
cd NouraLocal

# 2) ركّب مكتبات الـPOC
npm install llama.rn react-native-fs react-native-document-picker

# 3) انسخ ملفات الـPOC جوه المشروع (من الفولدر mobile/ ده):
#    - App.tsx                      → NouraLocal/App.tsx (يستبدل الموجود)
#    - src/persona/noura.ts         → NouraLocal/src/persona/noura.ts
#    - src/llm/LlamaService.ts      → NouraLocal/src/llm/LlamaService.ts

# 4) شغّل على الموبايل الموصول
npx react-native run-android
```

أول ما يفتح: اضغط **«اختار ملف الموديل»** ووديه على ملف الـGGUF → هينسخه ويحمّله (مرة واحدة بس) → وبعدها كلّمها بالمصري.

---

## ملاحظات مهمة
- **أول تحميل بياخد وقت** (بينسخ ٢.٥ جيجا) — بعد كده بيفتح على طول.
- **السرعة**: على الـS25 Ultra استنى تقريباً ١٠–١٥ كلمة/ثانية مع `n_gpu_layers: 99`. لو الجهاز سخن أو بطّأ، قلّل الرقم ده في `LlamaService.ts`.
- **الذاكرة**: التطبيق بيحمّل كل المحادثة في الرام (`n_ctx: 4096`). للـPOC تمام؛ للنسخة الكاملة هنضيف ذاكرة حقيقية + DB.
- **مفيش نت خالص**: تقدر تقفل الواي فاي والداتا وهتلاقيها شغالة.

## اللي بعد الـPOC (لو عجبك)
1. **ذاكرة + مزاج**: ننقل `src/lib/mood` و`src/lib/memory` + موديل embeddings صغير (EmbeddingGemma).
2. **DB لوكال + sync**: SQLite محلي بيـsync مع Neon (Turso/libSQL أو PowerSync).
3. **صور محلية**: Stable Diffusion / SDXL-Turbo عبر MediaPipe.
