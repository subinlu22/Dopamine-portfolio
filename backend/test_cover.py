# 전체 파이프라인 테스트 (UI 없이 직접 호출)
from full_pipeline import run_pipeline

result = run_pipeline(
    diary_text="오늘은 오랜만에 옛날 동네를 걸었다. 골목길이 예전 그대로라 마음이 따뜻해졌다.",
    genres=["발라드"],
    instruments=["피아노"],
    emotions=["따뜻함"],
    versions=1,
    duration=30,
)

print("=" * 50)
print(f"제목: {result['title']}")
print(f"감정: {result['emotion']}")
print(f"커버 경로: {result['cover_path']}")
print(f"오디오 경로: {result['audio_path']}")
print("=" * 50)