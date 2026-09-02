# 노래 2곡 + 커버 1개 공유 흐름 테스트 (Gemini 안 거침)
# 프론트가 하는 것과 똑같이 /generate-music을 순서대로 2번 호출:
# 1번째: 커버 새로 생성 / 2번째: 1번째 커버 파일명 넘겨서 재사용
import requests
import time

API = "http://127.0.0.1:8000"

# 기존에 뽑았던 가사 재사용 (Gemini 호출 안 함)
LYRICS = """[verse]
창밖을 스쳐 가는 바람 소리에
문득 고개 돌려 바라본 하늘
어제와 다를 바 없는 풍경인데
왠지 모르게 맘이 끌려

[chorus]
순간 멈춰선 발걸음
작은 놀라움에 눈 깜빡여
무언가 시작될 것 같은 예감
알 수 없는 이 설렘"""

def call_generate_music(reuse_cover_filename=""):
    data = {
        "lyrics": LYRICS,
        "genres": '["발라드"]',
        "instruments": '["피아노"]',
        "emotions": '["따뜻함"]',
        "versions": '[]',
        "duration": "90",
        "title": "커버공유테스트",
    }
    if reuse_cover_filename:
        data["reuse_cover_filename"] = reuse_cover_filename
    # 파일 업로드 없이 form-data로 보내기 (서버가 multipart 기대하므로 files 빈값 트릭 사용)
    resp = requests.post(f"{API}/generate-music", data=data, files={"_dummy": ("", "")})
    resp.raise_for_status()
    return resp.json()

print("=" * 50)
print("[1/2] Ver.1 생성 시작 (커버 새로 생성)")
t0 = time.time()
result1 = call_generate_music()
t1 = time.time()
print(f"[1/2] 완료 ({t1-t0:.0f}초) - 커버: {result1['cover_url']}")

cover_filename = result1["cover_url"].split("/")[-1]

print(f"[2/2] Ver.2 생성 시작 (커버 재사용: {cover_filename})")
t2 = time.time()
result2 = call_generate_music(reuse_cover_filename=cover_filename)
t3 = time.time()
print(f"[2/2] 완료 ({t3-t2:.0f}초) - 커버: {result2['cover_url']}")

print("=" * 50)
print(f"Ver.1 소요: {t1-t0:.0f}초 / Ver.2 소요: {t3-t2:.0f}초 / 총: {t3-t0:.0f}초")
same = result1["cover_url"] == result2["cover_url"]
print(f"커버 공유 확인: {'✅ 같은 커버' if same else '❌ 다른 커버 (재사용 실패)'}")
print("=" * 50)
