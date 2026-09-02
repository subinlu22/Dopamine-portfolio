# lyrics_pipeline.py
# 일기 텍스트 / 사진 / 음성 / 영상을 받아서 Gemini API(무료 티어)로
# 제목 + 감정분석 + 가사 생성 + 어울리는 장르 추천까지 한 번에 처리하는 파일

import os
import json
import base64
import requests

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
MODEL_NAME = "gemini-2.5-flash"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent"

SYSTEM_PROMPT = """너는 "도파민" 앱의 감정 분석가 겸 작사가야.
사용자가 준 내용(일기 텍스트, 사진, 음성, 또는 영상)을 보고 아래 순서로 작업해:

1. 이 가사에 어울리는 노래 제목을 2~6단어로 짧게 짓는다 (예: "그리움이 물드는 밤", "괜찮아질 거야")
2. 감정을 분석해서 2~3단어로 요약 (예: "잔잔한 그리움", "복잡한 불안감")
3. 그 감정을 담은 한국어 노래 가사를 작성한다.
   반드시 [verse]와 [chorus] 구조 태그를 넣어서 작성해 (음악 생성 모델이 이 태그로 곡 구조를 인식함)
   그리고 가사 맨 마지막에는 반드시 [outro] 파트를 짧게(1~3줄) 추가해줘.
   [outro]는 후렴을 그대로 반복하지 말고, 감정을 정리하며 여운을 남기고 자연스럽게 잦아드는
   느낌의 짧은 문장으로 써줘 (예: 후렴의 여운을 담은 한두 줄, 조용히 마무리되는 느낌).
   이렇게 하는 이유: [outro] 없이 곡이 끝나면 노래가 한창 진행되다가 갑자기
   뚝 끊기는 느낌이 나서, 마무리를 자연스럽게 유도하기 위함이야.
   가사 본문 안에서는 "/"(슬래시) 기호를 절대 사용하지 않는다.
   한 줄 안에서 두 소절을 잇고 싶어도 슬래시 대신 자연스러운 띄어쓰기나 줄바꿈(\\n)만 사용한다.
   예시 형식:
   [verse]\\n첫 줄 가사\\n둘째 줄 가사\\n[chorus]\\n후렴 첫 줄\\n후렴 둘째 줄\\n[verse]\\n...\\n[chorus]\\n...\\n[outro]\\n여운을 남기는 짧은 마무리 줄
   입력 내용이 짧거나 단순해도, 그 안에 담긴 감정을 자연스럽게 확장해서
   충분한 분량의 가사를 써줘 (아래 안내되는 목표 줄 수를 최대한 맞춰줘).
   단, 없는 사실을 지어내지 말고 감정선만 풍부하게 확장할 것.
4. 이 가사/감정에 어울리는 음악 장르 3개를 추천한다.
   (예: 발라드, 로파이, K팝, 어쿠스틱, 신스팝, 재즈 등)

반드시 아래 JSON 형식으로만 응답해.
{
  "title": "노래 제목",
  "emotion": "감정 요약",
  "lyrics": "[verse]\\n가사\\n[chorus]\\n가사\\n[outro]\\n마무리 가사... (줄바꿈은 \\n으로 표시, "/" 사용 금지)",
  "genre_suggestions": ["장르1", "장르2", "장르3"]
}"""


def _build_duration_instruction(duration: int) -> str:
    """
    노래 길이(초)에 맞춰 가사 목표 줄 수를 계산해서 안내 문구 생성.
    기준(어림값): 보컬이 한 줄을 부르는 데 대략 6초 정도 걸린다고 가정.
    """
    target_lines = max(6, round(duration / 6))
    return (
        f"\n\n[길이 안내] 이 가사는 {duration}초 길이의 노래에 쓰일 거야. "
        f"노래 길이를 자연스럽게 채우려면 대략 {target_lines}줄 정도의 가사가 필요해 "
        f"([outro] 줄도 이 분량 안에 포함해서 계산해줘). "
        f"[verse]/[chorus]를 여러 번 반복하거나 필요하면 [verse] 파트를 하나 더 추가해서 "
        f"이 분량에 최대한 맞춰줘. 억지로 늘리지 말고, 같은 감정을 다른 표현으로 풀어써서 자연스럽게 채워줘."
    )


def _call_gemini(parts: list, duration: int = 60) -> dict:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY 환경변수가 설정 안 됨. aistudio.google.com에서 키 발급 후 설정해줘")

    import time
    start = time.time()

    system_prompt_with_duration = SYSTEM_PROMPT + _build_duration_instruction(duration)

    payload = {
        "system_instruction": {"parts": [{"text": system_prompt_with_duration}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"responseMimeType": "application/json"}
    }
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
    }
    response = requests.post(API_URL, headers=headers, json=payload)
    response.raise_for_status()

    raw_text = response.json()["candidates"][0]["content"]["parts"][0]["text"]

    elapsed = time.time() - start
    print(f"[시간측정] 가사 생성(Gemini): {elapsed:.1f}초")

    return json.loads(raw_text)


def generate_lyrics_from_text(diary_text: str, duration: int = 60) -> dict:
    """일기 텍스트 -> {title, emotion, lyrics, genre_suggestions} 딕셔너리로 반환"""
    parts = [{"text": f"오늘의 일기:\n{diary_text}"}]
    return _call_gemini(parts, duration)


_AUDIO_MIME_MAP = {
    ".wav": "audio/wav",
    ".mp3": "audio/mp3",
    ".m4a": "audio/aac",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".webm": "audio/webm",
}

_VIDEO_MIME_MAP = {
    ".mp4": "video/mp4",
    ".mov": "video/mov",
    ".webm": "video/webm",
    ".avi": "video/avi",
}

_IMAGE_MIME_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}


def _guess_mime(path: str, mime_map: dict, default: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    return mime_map.get(ext, default)


def generate_lyrics_from_inputs(diary_text: str = None, image_path: str = None,
                                 audio_path: str = None, video_path: str = None,
                                 user_caption: str = "", duration: int = 60) -> dict:
    """
    일기 텍스트/사진/음성/영상 중 사용자가 선택한 것들을 원하는 만큼 조합해서
    한 번에 Gemini에 보내고 {title, emotion, lyrics, genre_suggestions}를 받는 통합 함수.

    예: 사진 + 영상만 선택 -> image_path, video_path만 넘기면 그 둘을 같이 분석함
    예: 일기 + 사진 선택 -> diary_text, image_path 같이 넘기면 텍스트+이미지 함께 분석함

    최소 하나는 반드시 있어야 함 (다 None이면 에러).
    """
    parts = []

    if image_path:
        with open(image_path, "rb") as f:
            image_b64 = base64.standard_b64encode(f.read()).decode("utf-8")
        media_type = _guess_mime(image_path, _IMAGE_MIME_MAP, "image/png")
        parts.append({"inline_data": {"mime_type": media_type, "data": image_b64}})

    if audio_path:
        with open(audio_path, "rb") as f:
            audio_b64 = base64.standard_b64encode(f.read()).decode("utf-8")
        media_type = _guess_mime(audio_path, _AUDIO_MIME_MAP, "audio/wav")
        parts.append({"inline_data": {"mime_type": media_type, "data": audio_b64}})

    if video_path:
        with open(video_path, "rb") as f:
            video_b64 = base64.standard_b64encode(f.read()).decode("utf-8")
        media_type = _guess_mime(video_path, _VIDEO_MIME_MAP, "video/mp4")
        parts.append({"inline_data": {"mime_type": media_type, "data": video_b64}})

    if not parts and not diary_text:
        raise ValueError("diary_text, image_path, audio_path, video_path 중 최소 하나는 있어야 해")

    # 어떤 입력들이 같이 들어왔는지 프롬프트에 명시해서, Gemini가 여러 자료를 종합해서 분석하게 유도
    input_kinds = []
    if diary_text:
        input_kinds.append("일기 텍스트")
    if image_path:
        input_kinds.append("사진")
    if audio_path:
        input_kinds.append("음성")
    if video_path:
        input_kinds.append("영상")

    prompt_text = f"아래 자료({', '.join(input_kinds)})를 종합해서 감정을 분석하고 가사를 만들어줘."
    if diary_text:
        prompt_text += f"\n\n오늘의 일기:\n{diary_text}"
    if user_caption:
        prompt_text += f"\n\n사용자가 남긴 코멘트: {user_caption}"

    parts.append({"text": prompt_text})
    return _call_gemini(parts, duration)


# ---------- 아래는 기존 코드 호환용 함수들 (내부적으로 통합 함수를 그대로 씀) ----------

def generate_lyrics_from_text(diary_text: str, duration: int = 60) -> dict:
    """일기 텍스트 -> {title, emotion, lyrics, genre_suggestions} 딕셔너리로 반환"""
    return generate_lyrics_from_inputs(diary_text=diary_text, duration=duration)


def generate_lyrics_from_photo(image_path: str, user_caption: str = "", duration: int = 60) -> dict:
    """사진 -> {title, emotion, lyrics, genre_suggestions} 딕셔너리로 반환"""
    return generate_lyrics_from_inputs(image_path=image_path, user_caption=user_caption, duration=duration)


def generate_lyrics_from_audio(audio_path: str, user_caption: str = "", duration: int = 60) -> dict:
    """음성(녹음) -> {title, emotion, lyrics, genre_suggestions} 딕셔너리로 반환"""
    return generate_lyrics_from_inputs(audio_path=audio_path, user_caption=user_caption, duration=duration)


def generate_lyrics_from_video(video_path: str, user_caption: str = "", duration: int = 60) -> dict:
    """영상 -> {title, emotion, lyrics, genre_suggestions} 딕셔너리로 반환"""
    return generate_lyrics_from_inputs(video_path=video_path, user_caption=user_caption, duration=duration)

# ---------- 그룹/듀엣 보컬용 가사 재포맷 (여기부터 새로 추가) ----------

GROUP_VERSION_NAMES = {"남자 그룹", "여자 그룹", "남녀 듀엣"}


def needs_vocal_part_split(versions: list) -> bool:
    """
    선택한 보컬 버전 중 하나라도 그룹/듀엣 계열이면 True.
    이런 버전은 여러 명이 번갈아/같이 부르는 느낌이 나야 하는데,
    지금 가사는 파트 구분이 하나도 없어서 ACE-Step이 목소리를 어색하게 섞어버리는 문제가 있었음.
    (남자 솔로/여자 솔로/아이돌 솔로는 어차피 한 명이 부르니까 재포맷 필요 없음)
    """
    return any(v in GROUP_VERSION_NAMES for v in (versions or []))


REFORMAT_SYSTEM_PROMPT = """너는 "도파민" 앱의 작사가야.
아래 가사는 이미 완성된 상태야. 내용, 단어, 줄거리는 절대 바꾸지 마.
다만 이 가사가 여러 명이 함께 부르는 그룹/듀엣 보컬로 불릴 예정이라서,
음악 생성 모델(ACE-Step)이 파트를 구분할 수 있도록 아래 규칙에 맞춰 "표기만" 다시 정리해줘.

규칙:
1. [verse] / [chorus] 구조는 그대로 유지
2. 화음이나 다른 목소리가 같이 부르는 배경 보컬 느낌을 주고 싶은 줄은 괄호로 표시
   예: "우린 다시 걸어가 (다시 걸어가)"
3. 완전히 새로운 가사를 짓지 말고, 기존 줄의 표기만 조정하거나
   필요하면 짧은 화음 반복구만 괄호로 추가하는 정도로만 손댈 것
4. 줄바꿈은 \\n으로 표시

반드시 아래 JSON 형식으로만 응답해.
{
  "lyrics": "[verse]\\n가사...\\n[chorus]\\n가사... (줄바꿈은 \\n으로 표시)"
}"""


def reformat_lyrics_for_group_vocals(lyrics: str, versions: list) -> str:
    """
    그룹/듀엣 보컬 선택 시, 기존 가사 내용은 그대로 두고
    괄호(배경 보컬/화음) 표기만 추가해서 파트가 나뉜 것처럼 보이게 재구성.
    temperature를 낮게 줘서 원문 내용이 최대한 안 바뀌게 함.
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY 환경변수가 설정 안 됨")

    version_text = ", ".join(versions)
    prompt_text = f"보컬 버전: {version_text}\n\n원본 가사:\n{lyrics}"

    payload = {
        "system_instruction": {"parts": [{"text": REFORMAT_SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": prompt_text}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2}
    }
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
    }
    response = requests.post(API_URL, headers=headers, json=payload)
    response.raise_for_status()

    raw_text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
    result = json.loads(raw_text)
    return result["lyrics"]
if __name__ == "__main__":
    test_diary = "오늘 시험 결과가 안 좋아서 하루 종일 기분이 가라앉았다. 그래도 저녁에 친구랑 통화하니까 조금 나아졌다."
    result = generate_lyrics_from_text(test_diary, duration=90)
    print(json.dumps(result, ensure_ascii=False, indent=2))
