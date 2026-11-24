# Fase 3 — Iterasi & Belajar

Tujuan: revisi tanpa riset ulang (versi baru), riwayat & bank hook, dan **aplikasi belajar dari video Anda yang laku**: Performance Log → winning patterns → masuk ke prompt angle/hook berikutnya. Plus Viral References.

Syarat: gate Fase 2 lulus. Tidak ada file baru; `reviseTask`, `viralExtractTask`, `viralPatternsBlock`, `winningBlock`, `performanceScore`, `markWinning`, `summarizeWinningPatterns`, `ViralPatternOut` sudah tersalin di Fase 1.

## Prompt untuk ditempel
```
Lanjutkan ke Fase 3 "Iterasi & Belajar" di agent.md §5 dan prd.md §2 [4]–[5]. Fase 0–2 sudah jalan, jangan ubah.
Tetap: semua AI lewat createLlm() (9router), tanpa Gemini.

1. Revisi (versi baru, non-destruktif):
   POST /api/scripts/:id/revise {instruction, sceneOrder?}
   - llm.generate({ stageName "partial_revise", schema ScriptDraftOut, content: (issues) => factsBlock(script.factsSnapshot) + reviseTask({scriptJson: JSON scenes+postingPacks+strategicBreakdown, instruction, sceneOrder, issues}), gate: gateScript(...) seperti Fase 2 }).
   - Jika sceneOrder diisi, server MENYALIN adegan lain dari versi lama (hanya adegan itu yang diambil dari hasil AI), lalu hitung ulang totalEstSec.
   - Audit ulang (stageName "audit"), lalu tulis dokumen scripts BARU: versionNo = max versi di rootScriptId + 1, parentVersionId = id lama, revisionReason = instruction, factsSnapshot sama. Dokumen lama TIDAK diubah.
   - TIDAK ada panggilan trend_pulse / product_research / brief_extract.
   Quick chips (design.md): "Lebih santai", "Lebih singkat (-30%)" (juga target durasi x0,7), "Lebih hard-sell", "Visual lebih sinematik", "Hapus kesan iklan", "Ganti ke faceless", + 1 baris instruksi bebas.
   Tombol "Terapkan" di setiap temuan audit = revise dengan instruction "Perbaiki: <problem>. Saran: <suggestedFix>" dan sceneOrder dari temuan.
2. Edit manual: owner boleh mengedit VO/teks adegan pada script status draft (firestore.rules sudah mengizinkan scenes/postingPacks/totalEstSec). Setelah simpan, POST /api/scripts/:id/audit menjalankan audit ulang dan memperbarui audit + status (server).
3. Riwayat (tab Riwayat): daftar script dikelompokkan per rootScriptId, terbaru di atas, filter status & kategori, pemilih versi (v1, v2, …) dengan tampilan beda singkat. Hapus versi hanya dengan konfirmasi.
4. Bank Hook: halaman semua hook isFavorite lintas produk, bisa disalin. Di route hooks Fase 1, isi hooksTask(favoriteHooks) dengan 10 hook favorit terbaru (verbalHook).
5. Performance Log:
   - Form di script status posted: platform (tiktok/shopee), link video, views, likes, komentar, shares, klik produk, terjual, komisi Rp. Semua opsional. Client membuat dokumen performanceLogs TANPA score/isWinning (rules melarang).
   - POST /api/performance/recompute (dipanggil otomatis setelah simpan log): hitung score = performanceScore(log) untuk semua log owner, winning = markWinning(...), tulis score & isWinning (server).
   - Winning patterns: ambil log isWinning -> script -> angle (sellingStyle), hook terpilih (psychologyType), product.category -> summarizeWinningPatterns(). Hasilnya masuk winningBlock(...) di route angles dan hooks (mengganti string kosong Fase 1). Hitung saat dibutuhkan; JANGAN menambah field baru ke appConfig (erd.md).
   - Tampilkan di Riwayat: skor, badge "Winning", dan ringkasan pola di atas daftar.
6. Viral References (menu di layar Tren):
   - Form: link video (opsional) + tempel caption/transkrip (wajib jika tanpa teks yang bisa dibaca) + tag. Client membuat dokumen viralReferences tanpa extractedPattern.
   - POST /api/viral-references/:id/extract: llm.generate({ stageName "viral_extract", schema ViralPatternOut, content: viralExtractTask(pastedText + url) }). JANGAN mengambil/scrape halaman TikTok. Tulis extractedPattern + tags (server).
   - Di route angles dan hooks, tambahkan viralPatternsBlock(5 pola terbaru) ke content.
7. Tambahkan test vitest: revisi sceneOrder hanya mengubah 1 adegan (fungsi merge murni, tanpa panggilan API), dan versionNo bertambah.

JANGAN: menimpa dokumen script lama, memanggil riset ulang saat revisi, menghitung score di client, menyalin kalimat dari video viral.
```

## Cek Kelulusan
- [ ] Revisi 1 adegan → muncul v2; v1 identik (bandingkan di Firebase Console); `apiRuns` hanya berisi `partial_revise` + `audit`, tanpa research.
- [ ] Tombol "Terapkan" di temuan audit membuat versi baru yang memperbaiki temuan itu.
- [ ] Edit VO manual → audit ulang berjalan; status `ready` hanya jika audit lolos.
- [ ] Isi Performance Log untuk ≥ 5 script → skor terisi, top 20% bertanda Winning.
- [ ] Generate angle untuk produk baru → `winning_patterns` ikut terkirim (cek: angle menyebut pola yang menang, atau minta agent menampilkan prompt di log server sekali).
- [ ] Tempel transkrip video viral → pola tersimpan (hookType, struktur), tidak berisi kalimat salinan.
- [ ] Bank Hook menampilkan hook favorit dari berbagai produk.

Setelah semua tercentang: buka `docs/fase-4.md`.
