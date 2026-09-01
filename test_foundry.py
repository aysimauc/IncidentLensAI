import asyncio

from foundry_local_sdk import Configuration, FoundryLocalManager


async def main():
    print("=" * 60)
    print("           INCIDENTLENS AI")
    print("=" * 60)
    print()

    # ---------------------------------------------------------
    # 1. Foundry Local'u başlat
    # ---------------------------------------------------------
    print("1) Foundry Local başlatılıyor...")

    config = Configuration(
        app_name="IncidentLensAI"
    )

    FoundryLocalManager.initialize(config)

    manager = FoundryLocalManager.instance

    print("   Foundry Local hazır.")
    print()

    # ---------------------------------------------------------
    # 2. Execution Provider'ları hazırla
    # ---------------------------------------------------------
    print("2) Execution Provider kontrol ediliyor...")
    print("   Bu işlem ilk seferde biraz sürebilir.")
    print()

    current_ep = ""

    def ep_progress(ep_name: str, percent: float):
        nonlocal current_ep

        if ep_name != current_ep:
            if current_ep:
                print()

            current_ep = ep_name

        print(
            f"\r   {ep_name:<30} {percent:5.1f}%",
            end="",
            flush=True
        )

    manager.download_and_register_eps(
        progress_callback=ep_progress
    )

    print()
    print("   Execution Provider hazır.")
    print()

    # ---------------------------------------------------------
    # 3. Modelleri listele
    # ---------------------------------------------------------
    print("3) Kullanılabilir modeller:")

    models = manager.catalog.list_models()

    for model in models:
        print(f"   - {model.alias}")

    print()

    # ---------------------------------------------------------
    # 4. Qwen modelini seç
    # ---------------------------------------------------------
    MODEL_ALIAS = "qwen3.5-4b"

    print(f"4) Model seçiliyor: {MODEL_ALIAS}")

    model = manager.catalog.get_model(MODEL_ALIAS)

    if model is None:
        print()
        print("HATA: Model bulunamadı!")
        print(f"Aranan model: {MODEL_ALIAS}")
        return

    print("   Model bulundu.")
    print()

    # ---------------------------------------------------------
    # 5. Modeli indir / hazırla
    # ---------------------------------------------------------
    print("5) Model kontrol ediliyor...")

    if not model.is_cached:
        print("   Model henüz bilgisayarda yok.")
        print("   Model indiriliyor...")

        model.download(
            lambda progress: print(
                f"\r   Model indirme: {progress:.1f}%",
                end="",
                flush=True
            )
        )

        print()
    else:
        print("   Model zaten bilgisayarda mevcut.")

    print()

    # ---------------------------------------------------------
    # 6. Modeli yükle
    # ---------------------------------------------------------
    print("6) Model yükleniyor...")

    model.load()

    print("   MODEL HAZIR!")
    print()

    # ---------------------------------------------------------
    # 7. Chat client
    # ---------------------------------------------------------
    print("7) Chat istemcisi oluşturuluyor...")

    client = model.get_chat_client()

    print("   Chat istemcisi hazır.")
    print()

    # ---------------------------------------------------------
    # 8. Incident
    # ---------------------------------------------------------
    messages = [
        {
            "role": "system",
            "content": """
Sen IncidentLens AI adlı teknik incident analiz asistanısın.

Görevin teknik olayları analiz etmektir.

Cevabını SADECE aşağıdaki formatta ver:

1. Önem Derecesi
2. Gözlenen Belirtiler
3. Olası Kök Nedenler
4. İlk Müdahale Önerileri
5. Kısa Incident Özeti

Türkçe cevap ver.

Kısa, teknik ve anlaşılır ol.

Kesin olmayan bilgileri kesin gerçek olarak sunma.
Kök nedenleri olasılık olarak belirt.
"""
        },
        {
            "role": "user",
            "content": """
Üretim ortamındaki ödeme API'sinde son 20 dakikadır HTTP 500
hatalarında ciddi bir artış gözleniyor.

Aynı zamanda veritabanı bağlantılarında zaman zaman kopmalar yaşanıyor.

Kullanıcıların bir kısmı ödeme işlemini tamamlayamıyor.

Bu incident'ı analiz et.
"""
        }
    ]

    # ---------------------------------------------------------
    # 9. STREAMING CHAT
    # ---------------------------------------------------------
    print("=" * 60)
    print("INCIDENTLENS AI ANALİZİ")
    print("=" * 60)
    print()

    print("Model cevap veriyor:")
    print()

    try:
        for chunk in client.complete_streaming_chat(messages):

            if not chunk.choices:
                continue

            content = chunk.choices[0].delta.content

            if content:
                print(content, end="", flush=True)

        print()
        print()
        print("=" * 60)
        print("Analiz tamamlandı.")
        print("=" * 60)

    except Exception as e:
        print()
        print()
        print("=" * 60)
        print("CHAT HATASI")
        print("=" * 60)
        print()
        print(type(e).__name__)
        print(str(e))
        print()

    finally:
        # -----------------------------------------------------
        # 10. Modeli kapat
        # -----------------------------------------------------
        print()
        print("Model kapatılıyor...")

        model.unload()

        print("Model kapatıldı.")


if __name__ == "__main__":
    asyncio.run(main())