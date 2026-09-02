# test_image_gen.py
# Gemini 이미지 생성 API가 지금 우리 키로 정상 작동하는지(+ 과금 없이 되는지) 확인하는 테스트 스크립트
# 실행: python test_image_gen.py (GEMINI_API_KEY 환경변수 설정된 상태에서)

import os
import base64
import requests

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY 환경변수가 설정 안 됨")

# 이미지 생성 가능한 모델 (Nano Banana 계열) - 텍스트 생성이랑 별도 모델임에 주의
MODEL_NAME = "gemini-2.5-flash-image"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent"

payload = {
    "contents": [{
        "role": "user",
        "parts": [{"text": "a simple minimalist album cover, warm sunset colors, abstract shapes, no text"}]
    }]
}

headers = {
    "Content-Type": "application/json",
    "x-goog-api-key": GEMINI_API_KEY
}

print("이미지 생성 요청 보내는 중...")
response = requests.post(API_URL, headers=headers, json=payload)

print(f"상태 코드: {response.status_code}")

if response.status_code != 200:
    print("에러 응답:")
    print(response.text)
else:
    data = response.json()
    parts = data["candidates"][0]["content"]["parts"]

    image_found = False
    for part in parts:
        if "inlineData" in part or "inline_data" in part:
            image_found = True
            inline = part.get("inlineData") or part.get("inline_data")
            image_b64 = inline["data"]
            with open("test_album_cover.png", "wb") as f:
                f.write(base64.standard_b64decode(image_b64))
            print("✅ 성공! test_album_cover.png 파일로 저장됨 - 열어서 확인해봐")

    if not image_found:
        print("이미지가 응답에 없음. 전체 응답 구조:")
        print(data)
