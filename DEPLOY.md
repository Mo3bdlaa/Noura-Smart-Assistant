# نشر نورا على Vercel + Neon (لينك دائم)

المشروع جاهز للنشر. التطبيق فيه **شاشة Setup أول-مرة**، فمش محتاج تزرع داتا يدويًا —
هتفتح اللينك وتظبّط كل حاجة من المتصفح (الأدمن + مفتاح Gemini + اسم نورا).

## ١) قاعدة البيانات (Neon — مجاني)
1. اعمل حساب على https://neon.tech واعمل Project جديد (اختار region قريب).
2. في **SQL Editor** بتاع Neon نفّذ:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. هات **Connection string** بتاع الـ **Pooled connection** (فيه `-pooler` في الهوست،
   وبيخلص بـ `?sslmode=require`). ده اللي هنحطه في `DATABASE_URL`.

## ٢) طبّق السكيمة على Neon
من جهازك (مرة واحدة)، أو من أي مكان يوصل لـ Neon:
```bash
DATABASE_URL="<neon-pooled-url>" npm run db:push
```
> أو بديل: انسخ محتوى `drizzle/0000_init.sql` والصقه في SQL Editor بتاع Neon (بيعمل الامتداد + كل الجداول).

## ٣) انشر على Vercel
1. ادخل https://vercel.com واربط حساب GitHub، واستورد الريبو
   `mo3bdlaa/noura-smart-assistant` (برانش `claude/noura-ai-assistant-CSVJ9`).
2. في **Environment Variables** حط:

   | المتغير | القيمة |
   |---|---|
   | `DATABASE_URL` | رابط Neon المجمّع (pooled) |
   | `SESSION_SECRET` | نص عشوائي ٣٢ حرف+ (`openssl rand -base64 32`) |
   | `GEMINI_CHAT_MODEL` | `gemini-2.5-flash` (اختياري) |
   | `GEMINI_API_KEY` | اختياري — تقدر تسيبه وتحطه من شاشة الـ Setup |
   | `REGISTRATION_OPEN` | `false` لو عايزه ليك إنت بس بعد التظبيط، أو `true` |

3. اضغط **Deploy**. (الـ `vercel.json` فيه cron جاهز لتصريف الـ jobs.)

## ٤) أول تشغيل
افتح لينك Vercel → هيوديك على **/setup**:
أهلًا → حسابك (أدمن) → مفتاح Gemini → اسم نورا (تقدر تسميها "نورا" لإنك الأدمن) → خلّصنا 🎉
وتبدأ تكلّم نورا على طول.

## ملاحظات
- **Gemini key مجاني:** https://aistudio.google.com/apikey
- استخدم **pooled** connection بتاع Neon (مهم للـ serverless).
- بعد ما تظبّط الأدمن، يُفضّل تخلي `REGISTRATION_OPEN=false` لو التطبيق ليك/لدائرتك بس.
- استخراج الذاكرة بيحصل بعد كل رسالة (`after()`)، والـ cron بيصرّف أي متأخرات.
