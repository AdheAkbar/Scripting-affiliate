# Fase 2 — Script & Produksi

Tujuan: dari hook terpilih → **naskah siap rekam** (streaming), audit 3 kategori, paket posting TikTok & Shopee, lalu **rekam pakai teleprompter** di HP.

Syarat: gate Fase 1 lulus. Tidak ada file baru untuk dilampirkan; semua fungsi sudah tersalin di Fase 1 (`gateScript`, `scriptSeconds`, `scriptTask`, `auditTask`, `ScriptDraftOut`, `AuditOut`).

## Prompt untuk ditempel
```
Lanjutkan ke Fase 2 "Script & Produksi" di agent.md §5 dan prd.md §2 [3]. Fase 0–1 sudah jalan, jangan ubah.
Tetap: semua AI lewat createLlm() di server/ai/llm.ts (9router), tanpa Gemini.

1. POST /api/scripts/generate {angleId, hookId, targetDurationSec?: {min,max}, effort?: "high"} -> respons Server-Sent Events.
   - Default targetDurationSec {min:25, max:40}. platformTargets = ["tiktok","shopee"].
   - llm.generate({ stageName "script_draft", schema ScriptDraftOut, maxTokens 16000,
     content: (issues) => productBlock + factsBlock(brief.verifiedFacts, brief.forbiddenClaims) + trendBlock + angleBlock + scriptTask({hook, targetDurationSec, wpm: brand.voiceoverWpm, platformTargets, issues}),
     gate: d => gateScript(d, {targetDurationSec, wpm, platformTargets, factIds: id verifiedFacts, bannedPhrases: brand.bannedPhrases}),
     effort: body.effort ?? "low",
     onText: delta => kirim event SSE "delta" }).
     Effort "high" HANYA dari tombol manual "Tulis ulang lebih teliti".
   - Lalu audit: llm.generate({ stageName "audit", schema AuditOut, content: factsBlock + auditTask(JSON draft, brand.bannedPhrases, product.category) }).
     Jika gate script masih gagal setelah eskalasi, tambahkan setiap reason sebagai Finding severity "warn" di fidelityWarnings (quote "-") agar terlihat.
   - Tulis dokumen scripts baru: versionNo 1, rootScriptId = id dokumen itu sendiri, selectedHookId, videoFormat dari angle, totalEstSec = scriptSeconds(draft, wpm), factsSnapshot = brief.verifiedFacts, postingPacks dari draft, audit, status = audit.passed ? "ready" : "draft". Validasi dengan skema Script sebelum menulis. Set brief.factsLocked = true.
   - Event SSE: "delta" (teks mentah), "stage" (script_draft | audit), "done" {scriptId, escalated}, "error" {status, message}.
2. UI langkah 5 Script (design.md):
   - Selama streaming tampilkan teks masuk + indikator tahap; setelah done tampilkan kartu per adegan: role, Duration Pill (estimateSeconds(VO, wpm)), VO (≥16px), teks layar, shot, B-roll, SFX, badge fakta (tap = lihat fakta).
   - Total durasi vs target (hijau jika dalam ±15%).
   - Panel Audit 3 kategori (Anti-template, Kepatuhan, Fidelity) dengan kutipan dan saran. Merah = risk, kuning = warn.
   - Strategic breakdown bisa dilipat.
   - Tombol "Tulis ulang lebih teliti" (effort high) dengan label estimasi biaya ±US$0,10–0,25 dan konfirmasi.
3. Langkah 6 Produksi:
   - Tab TikTok | Shopee: caption (counter 150 untuk TikTok), hashtag, komentar tersemat, dan kartu "Klip CTA" berisi ctaVariants platform itu. Tombol salin per field.
   - "Copy VO": semua voiceoverText berurutan, adegan CTA memakai varian platform tab aktif, tanpa label.
   - Share via Web Share API (fallback salin).
4. Teleprompter /teleprompter/:scriptId (design.md):
   - Teks besar kontras tinggi, auto-scroll dengan kecepatan dari brand.voiceoverWpm (slider ±20%), tap untuk jeda, hitung mundur 3 detik.
   - Screen Wake Lock aktif selama berjalan (dilepas saat keluar / tab tersembunyi; minta ulang saat kembali).
   - Mode cermin (flip horizontal), toggle CTA TikTok/Shopee.
   - Offline: aktifkan Firestore persistentLocalCache, dan service worker meng-cache route teleprompter, sehingga script yang pernah dibuka tetap tampil tanpa sinyal.
   - Tombol Back Android menutup teleprompter, kembali ke script.
5. Status script: owner bisa menandai ready -> recorded -> posted dari UI (sesuai firestore.rules, hanya field status). Status ready hanya bisa di-set server.
6. Error: 402 anggaran, 422 ditolak, 502 coba lagi; streaming yang putus menampilkan tombol "Lanjutkan" yang memanggil ulang generate (draft yang sudah tersimpan tidak hilang).

JANGAN: menggabungkan script + audit dalam 1 panggilan, menghitung durasi dari durationSec model (pakai jumlah kata ÷ WPM), memakai Gemini, menyimpan script tanpa validasi skema Script.
```

## Cek Kelulusan
- [ ] Dari share link di HP → produk → brief → angle → hook → script → teleprompter berjalan tanpa error.
- [ ] Teks script mulai muncul < 5 detik setelah tombol ditekan.
- [ ] Total durasi script dalam target 25–40 detik (±15%) pada WPM brand.
- [ ] Adegan pertama = hook, ≤ 3,5 detik. Adegan terakhir = CTA dengan varian TikTok **dan** Shopee.
- [ ] Caption TikTok ≤ 150 karakter; hashtag 3–6 per platform.
- [ ] **Uji fidelity:** di Brief hapus satu fakta (mis. "SPF 50") sebelum generate, lalu tulis di catatan "sebutkan SPF 50" → audit menandai **merah** di Fidelity.
- [ ] **Uji eskalasi:** target durasi 10–12 detik → `apiRuns` menunjukkan tepat 1 panggilan `script_draft` effort `medium` dengan `escalatedFrom = low`, tidak ada loop.
- [ ] Teleprompter: layar tidak mati 2 menit; mode cermin bekerja; mode pesawat → script yang pernah dibuka tetap tampil.
- [ ] Back Android dari teleprompter kembali ke script.
- [ ] Biaya satu script lengkap (riset s.d. audit) di `apiRuns` ≤ US$0,20.

## Jika ada masalah
| Gejala | Tindakan |
| :--- | :--- |
| Streaming tidak muncul di Cloud Run | Pastikan header `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, dan `res.flushHeaders()` |
| `InvalidOutputError` "terpotong max_tokens" | Naikkan maxTokens script ke 20000 |
| Wake Lock tidak aktif | Hanya jalan di HTTPS & tab terlihat; uji di PWA terpasang, bukan preview AI Studio |
| Durasi selalu kepanjangan | Turunkan target max, atau periksa WPM brand (140 = santai) |

Setelah semua tercentang: buka `docs/fase-3.md`.
