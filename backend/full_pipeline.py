# full_pipeline.py
# 전체 흐름: 일기/사진/음성/영상 입력 -> Gemini로 제목+가사 생성 -> 장르/악기/감정/보컬 선택 -> ACE-Step 1.5 API로 음악 생성
#
# ===== 2026.07.15 변경사항 =====
# 1. 시간측정 로그 추가 (가사 생성 / 음악 생성 각각 터미널에 [시간측정]으로 표시, 프론트엔드엔 노출 안 됨)
# 2. generate_album_cover_sdxl()이 lyrics(가사)까지 자식 프로세스로 넘기도록 수정
#    -> generate_cover_standalone.py가 제목+가사에서 시각 키워드를 뽑아서
#       더 어울리는 이미지를 만들 수 있게 하기 위함

import os
import re
import sys
import time
import json
import uuid
import subprocess
import requests
from lyrics_pipeline import generate_lyrics_from_text, generate_lyrics_from_photo

ACE_API_URL = "http://127.0.0.1:8001"

GENRE_TAG_MAP = {
    "K-POP": "k-pop, catchy synth, punchy drums, bright vocal",
    "발라드": "ballad, piano, strings, emotional, warm",
    "트로트": "korean trot, lively accordion, cheerful, traditional pop",
    "밴드": "band sound, rock band, guitar drums bass",
    "힙합": "hip hop, boom bap beat, rhythmic vocal",
    "R&B": "r&b, smooth groove, soulful vocal",
    "소울": "soul, gospel-influenced, emotive vocal",
    "인디": "indie, lo-fi guitar, understated vocal",
    "얼터너티브": "alternative rock, distorted guitar, moody",
    "록": "rock, electric guitar, driving drums",
    "재즈": "jazz, smooth saxophone, soft piano, relaxed vocal",
    "클래식": "classical, orchestral, strings, elegant",
    "댄스": "dance pop, four on the floor beat, energetic",
    "팝": "pop, catchy hook, bright production",
    "신스팝": "synth-pop, retro synth, groovy bass",
    "포크": "folk, acoustic guitar, storytelling vocal",
    "뉴웨이브": "new wave, synth, post-punk energy",
    "EDM": "edm, festival build up, big drop, synth bass",
    "펑크": "punk rock, fast tempo, raw energy",
    "앰비언트": "ambient, atmospheric pads, minimal",
    "트립합": "trip hop, dark beat, moody atmosphere",
    "국악": "korean traditional music, gugak, traditional instruments",
    "월드뮤직": "world music, ethnic instruments, global fusion",
    "레게": "reggae, offbeat guitar, laid-back groove",
    "블루스": "blues, expressive guitar, soulful vocal",
    "메탈": "metal, heavy distorted guitar, aggressive",
    "컨트리": "country, acoustic guitar, storytelling, twang",
    "라틴": "latin, congas, upbeat rhythm, brass",
    "하우스": "house, four on the floor, deep bass",
    "테크노": "techno, driving beat, hypnotic synth",
    "판소리": "pansori, korean traditional vocal storytelling, drum accompaniment",
    "뮤지컬": "musical theatre, orchestral, dramatic vocal",
    "사운드트랙": "cinematic soundtrack, orchestral, epic",
    "일렉트로닉": "electronic, synth-driven, modern production",
}

INSTRUMENT_TAG_MAP = {
    "피아노": "piano",
    "어쿠스틱기타": "acoustic guitar",
    "일렉트릭기타": "electric guitar",
    "베이스": "bass",
    "드럼": "drums",
    "신스": "synth",
    "바이올린": "violin",
    "첼로": "cello",
    "플루트": "flute",
    "클라리넷": "clarinet",
    "색소폰": "saxophone",
    "트럼펫": "trumpet",
    "가야금": "gayageum",
    "거문고": "geomungo",
    "대금": "daegeum",
    "피리": "piri",
    "해금": "haegeum",
    "장고": "janggu",
    "북": "traditional korean drum",
    "오르간": "organ",
    "하프": "harp",
    "우쿨렐레": "ukulele",
    "만돌린": "mandolin",
    "호른": "horn",
}

EMOTION_TAG_MAP = {
    "밝음": "bright",
    "행복": "happy",
    "우울": "melancholic",
    "슬픔": "sad",
    "차분": "calm",
    "고요함": "quiet, serene",
    "신남": "upbeat, exciting",
    "활기": "energetic",
    "로맨틱": "romantic",
    "사랑스러움": "lovely, sweet",
    "신비": "mysterious",
    "몽환": "dreamy",
    "에너지": "energetic",
    "잔잔함": "gentle, soft",
    "평온": "peaceful",
    "그리움": "nostalgic, longing",
    "희망": "hopeful",
    "긍정": "positive",
    "애잔함": "poignant, bittersweet",
    "명상": "meditative",
    "설렘": "excited anticipation",
    "고민": "pensive, contemplative",
    "충만함": "fulfilling, uplifting",
}

# 보컬/버전 옵션 - 친구가 다중선택으로 확장한 "버전" 목록에 맞춰 태그 매핑
# 참고: 그룹/아이돌/보컬로이드/내레이션은 ACE-Step에서 파트 분리가 불안정할 수 있음 (실험적 기능)
VOCAL_TAG_MAP = {
    "남자 솔로": "male vocal, solo",
    "여자 솔로": "female vocal, solo",
    "남성보컬": "male vocal, solo",     # 예전 이름 호환용
    "여성보컬": "female vocal, solo",   # 예전 이름 호환용
    "남자 그룹": "male group vocals, boy group harmonies, all male voices only, no female vocal",
    "여자 그룹": "female group vocals, girl group harmonies, all female voices only, no male vocal",
    "남녀 듀엣": "duet, clear male vocal and female vocal, alternating male and female voice, distinct contrasting voices",
}


import hashlib
import colorsys
from PIL import Image, ImageDraw, ImageFilter
import random
GENRE_HUE_MAP = {
    "K-POP": 320,
    "발라드": 250,
    "트로트": 335,
    "밴드": 10,
    "힙합": 15,
    "R&B": 280,
    "소울": 270,
    "인디": 190,
    "얼터너티브": 350,
    "록": 5,
    "재즈": 30,
    "클래식": 45,
    "댄스": 310,
    "팝": 340,
    "신스팝": 200,
    "포크": 90,
    "뉴웨이브": 260,
    "EDM": 185,
    "펑크": 25,
    "앰비언트": 220,
    "트립합": 265,
    "국악": 130,
    "월드뮤직": 150,
    "레게": 110,
    "블루스": 210,
    "메탈": 355,
    "컨트리": 40,
    "라틴": 15,
    "하우스": 300,
    "테크노": 180,
    "판소리": 20,
    "뮤지컬": 330,
    "사운드트랙": 240,
    "일렉트로닉": 195,
}
# 장르별 색조(hue, 0~360) - 장르는 "어떤 색 계열"인지만 결정하고, 밝기는 감정이 결정함
GENRE_EN_MAP = {
    "K-POP": "k-pop",
    "발라드": "ballad",
    "트로트": "korean trot",
    "밴드": "band rock",
    "힙합": "hip hop",
    "R&B": "R&B",
    "소울": "soul",
    "인디": "indie",
    "얼터너티브": "alternative rock",
    "록": "rock",
    "재즈": "jazz",
    "클래식": "classical",
    "댄스": "dance",
    "팝": "pop",
    "신스팝": "synth pop",
    "포크": "folk",
    "뉴웨이브": "new wave",
    "EDM": "EDM",
    "펑크": "funk",
    "앰비언트": "ambient",
    "트립합": "trip hop",
    "국악": "traditional korean music",
    "월드뮤직": "world music",
    "레게": "reggae",
    "블루스": "blues",
    "메탈": "metal",
    "컨트리": "country",
    "라틴": "latin",
    "하우스": "house",
    "테크노": "techno",
    "판소리": "korean pansori",
    "뮤지컬": "musical theatre",
    "사운드트랙": "cinematic soundtrack",
    "일렉트로닉": "electronic",
}

def genres_to_english(genres: list) -> str:
    """
    한글 장르 리스트를 영어 설명으로 바꿔주는 함수.
    매핑에 없는 장르가 와도 "emotional"로 안전하게 대체돼서
    한글 텍스트가 그대로 프롬프트에 섞이는 걸 막아줌.
    """
    if not genres:
        return "emotional"
    mapped = [GENRE_EN_MAP.get(g, "emotional") for g in genres[:2]]
    return ", ".join(mapped)

# 감정 텍스트에서 밝기를 계산하기 위한 키워드 사전
# (Gemini가 자유롭게 만들어내는 감정 요약 문구, 예: "실망 속 위안", "잔잔한 그리움"에서 추출)
NEGATIVE_EMOTION_KEYWORDS = [
    "슬픔", "슬픈", "우울", "불안", "걱정", "외로움", "고독", "답답", "지침", "피곤",
    "분노", "화남", "짜증", "허탈", "상실", "이별", "그리움", "아픔", "고통", "절망",
    "두려움", "공포", "후회", "죄책감", "무기력", "쓸쓸함", "허무", "실망", "좌절", "가라앉"
]

POSITIVE_EMOTION_KEYWORDS = [
    "행복", "기쁨", "즐거움", "신남", "설렘", "희망", "긍정", "사랑", "따뜻함", "평온",
    "감사", "만족", "자신감", "활기", "생동감", "웃음", "밝음", "밝은", "충만", "포근함",
    "안도", "위안", "다짐", "성취", "찬란"
]


def _compute_emotion_valence(emotion_text: str) -> float:
    """
    감정 텍스트의 긍정/부정 키워드 개수를 비교해서 -1.0(어두움) ~ 1.0(밝음) 점수 계산.
    키워드가 하나도 안 걸리면 0.0(중립)으로 처리.
    """
    pos_count = sum(1 for kw in POSITIVE_EMOTION_KEYWORDS if kw in emotion_text)
    neg_count = sum(1 for kw in NEGATIVE_EMOTION_KEYWORDS if kw in emotion_text)

    total = pos_count + neg_count
    if total == 0:
        return 0.0
    return (pos_count - neg_count) / total


def _hash_to_hue(text: str) -> int:
    """매핑에 없는 장르면 이름을 해시해서 일관된 색조를 만들어냄 (같은 이름은 항상 같은 색조)"""
    return int(hashlib.md5(text.encode()).hexdigest(), 16) % 360


def generate_album_cover(title: str, emotion: str, genres: list, instruments: list = None, size: int = 1024) -> str:
    """
    코드로 직접 그리는 앨범 커버 (외부 API 의존 없음 - 100% 무료, 항상 안정적으로 동작).

    핵심 설계: "장르는 색조(hue), 감정은 밝기(lightness)를 결정한다"
    - 우울하거나 슬픈 감정일수록 어두운 톤
    - 밝고 희망찬 감정일수록 밝은 톤
    -> 커버만 봐도 "아, 오늘 감정이 어두웠구나/밝았구나"를 직관적으로 알 수 있게 함

    이전엔 장르가 밝기까지 정해버려서(예: 힙합=항상 어두움) 감정이랑 안 맞을 수 있었는데,
    이제 장르는 "무슨 색 계열이냐"만 정하고 밝기는 감정이 전담함.
    """
    genres = genres or ["발라드"]
    main_genre = genres[0]

    hue = GENRE_HUE_MAP.get(main_genre, _hash_to_hue(main_genre))

    valence = _compute_emotion_valence(emotion)
    base_lightness = 0.5 + valence * 0.28  # -1~1 점수를 0.22~0.78 밝기로 변환

    # 그라데이션 두 색: 같은 색조(hue)에서 밝기만 살짝 다르게 (은은한 그라데이션)
    r1, g1, b1 = colorsys.hls_to_rgb(hue / 360, max(base_lightness - 0.12, 0.08), 0.5)
    r2, g2, b2 = colorsys.hls_to_rgb((hue + 25) / 360, min(base_lightness + 0.12, 0.9), 0.55)
    color1 = (int(r1 * 255), int(g1 * 255), int(b1 * 255))
    color2 = (int(r2 * 255), int(g2 * 255), int(b2 * 255))

    # 강조 블롭 색: 반대쪽 색조(보색 계열)로 살짝 포인트, 밝기는 배경보다 조금 더 밝게
    accent_hue = (hue + 180) % 360
    ar, ag, ab = colorsys.hls_to_rgb(accent_hue / 360, min(base_lightness + 0.2, 0.85), 0.6)
    accent = (int(ar * 255), int(ag * 255), int(ab * 255))

    # 1. 대각선 그라데이션 배경
    img = Image.new("RGB", (size, size))
    pixels = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            r = int(color1[0] * (1 - t) + color2[0] * t)
            g = int(color1[1] * (1 - t) + color2[1] * t)
            b = int(color1[2] * (1 - t) + color2[2] * t)
            pixels[x, y] = (r, g, b)

    # 2. 추상 원형 블롭 레이어 (블러 처리해서 부드럽게)
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    random.seed(title or main_genre)  # 같은 제목이면 같은 배치가 나오게 (재현 가능)
    for _ in range(4):
        cx = random.randint(0, size)
        cy = random.randint(0, size)
        radius = random.randint(size // 6, size // 3)
        alpha = random.randint(35, 80)
        draw.ellipse(
            [cx - radius, cy - radius, cx + radius, cy + radius],
            fill=(accent[0], accent[1], accent[2], alpha)
        )

    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=size // 12))
    img = Image.composite(overlay, img.convert("RGBA"), overlay).convert("RGB")

    os.makedirs("output/covers", exist_ok=True)
    filename = _sanitize_filename(title)
    save_path = f"output/covers/{filename}.png"
    img.save(save_path)

    print(f"[앨범 커버] 저장 완료: {save_path}")
    return save_path
_sdxl_pipe = None

# (7/14 구조 변경) _load_sdxl_pipeline 함수는 제거됨.
# SDXL 모델 로딩은 이제 generate_cover_standalone.py(별도 프로세스)에서만 일어남.
# 이 파일(백엔드)에서는 torch/diffusers를 import하지 않아서 GPU를 아예 건드리지 않음.
# 자세한 이유는 generate_album_cover_sdxl 함수 docstring 참고.

COVER_STYLE_PROMPTS = {
    "gradient": "minimalist abstract gradient art, smooth color blending, modern geometric shapes",
    "illustration": "soft illustration style, hand-drawn feel, warm painterly textures, gentle brush strokes",
    "film": "vintage photographic aesthetic, fine grainy texture, faded nostalgic warm tones, muted retro color palette",
    "dreamy": "soft surreal atmosphere, gentle pastel color palette, warm glowing light, delicate airy composition",
    "poster": "bold pop art poster style, vibrant high contrast colors, graphic shapes, striking composition",
    "watercolor": "delicate watercolor painting, soft wet-on-wet technique, gentle color bleeding",
    "minimal_line": "single continuous line art, minimalist black and white sketch, elegant simplicity",
    "collage": "vintage paper collage aesthetic, torn paper edges, mixed media texture",
    "neon": "neon glow aesthetic, vibrant cyberpunk colors, glowing light trails",
}
ANIMAL_KEYWORDS = {
    "강아지": "dog", "개": "dog", "고양이": "cat", "냥이": "cat",
    "새": "bird", "나비": "butterfly", "사슴": "deer", "토끼": "rabbit",
    "여우": "fox", "고래": "whale", "물고기": "fish", "곰": "bear",
    "늑대": "wolf", "판다": "panda", "부엉이": "owl", "올빼미": "owl",
}

def detect_animal_in_lyrics(lyrics: str) -> str | None:
    """
    가사 텍스트에서 동물 단어를 찾아서 영어로 반환하는 함수.
    가사에 동물이 언급됐을 때만 캐릭터로 반영하기 위함.
    없으면 None 반환.
    """
    for kr_word, en_word in ANIMAL_KEYWORDS.items():
        if kr_word in lyrics:
            return en_word
    return None

def build_cover_prompt(title: str, emotion: str, genres: list, instruments: list = None, style: str = "gradient", lyrics: str = "") -> str:
    """
    앨범 커버 이미지 생성용 영어 프롬프트 만드는 함수.
    사람/동물/캐릭터 없이 배경·사물·풍경 위주로만 생성되게 강하게 제한.

    참고: 실제 SDXL 이미지 생성은 generate_cover_standalone.py(별도 프로세스)가 담당하고,
    거기서도 동일한 로직(build_cover_prompt)이 별도로 정의돼 있음. 이 함수는 현재
    직접적으로 이미지 생성에 쓰이진 않지만(백엔드 프로세스), 참고용으로 유지.
    """
    genre_desc = genres_to_english(genres)
    style_desc = COVER_STYLE_PROMPTS.get(style, COVER_STYLE_PROMPTS["gradient"])

    prompt = (
        f"album cover art, {style_desc}, {genre_desc} music mood, "
        f"emotion of {emotion}, professional album artwork, "
        f"peaceful empty scenery, abstract composition, meaningful everyday objects, "
        f"cozy atmosphere, no people, no humans, no characters, no animals, no creatures, "
        f"high quality, artistic, no text, no words, no letters, no logos"
    )
    return prompt
def pick_style_from_emotion(emotion: str) -> str:
    """
    감정 텍스트의 긍정/부정 정도(valence)에 따라 커버 스타일을 자동으로 고르는 함수.
    기존 Pillow 커버에서 쓰던 _compute_emotion_valence()를 재사용해서
    새로운 실패 지점 없이 안전하게 감.
    """
    valence = _compute_emotion_valence(emotion)
    if valence >= 0.5:
        return "poster"
    elif valence >= 0.15:
        return "illustration"
    elif valence >= -0.15:
        return "gradient"
    elif valence >= -0.5:
        return "dreamy"
    else:
        return "film"

def generate_album_cover_sdxl(title: str, emotion: str, genres: list, instruments: list = None, size: int = 1024, style: str = "gradient", lyrics: str = "") -> str:
    """
    로컬 SDXL-Turbo로 실제 AI 이미지 생성해서 앨범 커버 만드는 함수.

    구조 변경 (7/14): SDXL을 이 프로세스(백엔드) 안에서 직접 돌리지 않고,
    별도 프로세스(generate_cover_standalone.py)를 subprocess로 실행하는 방식으로 완전 분리함.

    왜 분리했는지 (중요):
    예전 방식(백엔드 안에서 SDXL 로드 + torch.cuda.empty_cache로 해제)은
    "해제 완료" 로그가 찍혀도 CUDA 컨텍스트(기본 예약분)가 프로세스가 살아있는 한
    GPU에서 반환되지 않아서, 커버를 한 번 만들면 백엔드가 GPU 메모리를 영구 점유했음.
    -> 그 다음 ACE-Step이 노래 만들 때 VRAM 부족 -> CPU 디코딩으로 전환 -> 타임아웃.
    (nvidia-smi에서 백엔드 python.exe가 GPU를 계속 쥐고 있는 걸로 확인된 문제)

    지금 방식: 커버 생성 때마다 자식 프로세스를 새로 띄우고, 저장이 끝나면 그 프로세스가
    완전히 종료됨 -> CUDA 컨텍스트 포함 GPU 메모리가 OS에 100% 반환됨 (OS 레벨 보장).
    백엔드 프로세스는 torch를 import조차 안 하므로 GPU를 아예 건드리지 않음.
    비용: 프로세스 시작 + 모델 로딩 시간(약 20~30초)이 커버마다 추가되지만,
    커버는 곡당 1번만 만들므로 감당 가능한 수준.

    2026.07.15 변경: lyrics(가사)도 자식 프로세스로 넘겨서, 제목/가사 안의 시각 키워드
    (별, 바다, 노을 등)가 이미지 프롬프트에 반영되게 함 -> 가사 내용과 더 어울리는 커버가 나옴.
    """
    os.makedirs("output/covers", exist_ok=True)
    filename = _sanitize_filename(title)
    save_path = f"output/covers/{filename}.png"

    # 이 파일(full_pipeline.py)과 같은 폴더에 있는 standalone 스크립트 경로
    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "generate_cover_standalone.py")

    command = [
        sys.executable,  # 지금 백엔드를 돌리고 있는 것과 같은 파이썬(venv311)으로 실행
        script_path,
        "--title", title or "untitled",
        "--emotion", emotion or "emotional",
        "--genres", json.dumps(genres or [], ensure_ascii=False),
        "--instruments", json.dumps(instruments or [], ensure_ascii=False),
        "--style", style,
        "--lyrics", lyrics or "",   # 신규: 가사 전체 텍스트 (시각 키워드 추출용)
        "--output", save_path,
    ]

    cover_start = time.time()   # 시간측정: 커버 생성 시작 (프로세스 시작~완전 종료까지)
    print(f"[앨범 커버-SDXL] 별도 프로세스로 생성 시작 (style={style})")
    result = subprocess.run(
        command,
        capture_output=True,
        encoding="utf-8",   # 한글 출력 깨짐(cp949 UnicodeDecodeError) 방지
        errors="replace",
        timeout=300,        # 5분 안에 안 끝나면 실패 처리 (모델 다운로드 등 이상 상황 대비)
    )

    # 성공 판정: stdout 문자열 파싱 대신 "실제로 파일이 디스크에 생겼는지"로 직접 확인.
    # (이전엔 stdout에서 "COVER_SAVED:..." 문자열을 찾는 방식이었는데, returncode=0으로
    #  정상 종료됐는데도 이 매칭이 실패해서 실제로는 성공한 걸 실패로 오판하는 문제가 있었음 -
    #  자식 프로세스 stdout이 로그/진행바랑 섞이면서 버퍼링 문제가 있었던 것으로 추정.
    #  파일 존재 여부는 훨씬 확실한 신호라 이걸로 교체함.)
    if result.returncode != 0 or not os.path.exists(save_path):
        print(f"[앨범 커버-SDXL] 자식 프로세스 실패 (returncode={result.returncode}, 파일존재={os.path.exists(save_path)})")
        if result.stdout:
            print(f"[앨범 커버-SDXL] stdout(마지막 500자): {result.stdout[-500:]}")
        if result.stderr:
            print(f"[앨범 커버-SDXL] stderr(마지막 500자): {result.stderr[-500:]}")
        raise RuntimeError("SDXL 커버 생성 프로세스 실패")

    print(f"[앨범 커버-SDXL] 저장 완료: {save_path} (프로세스 종료 - GPU 완전 반환됨)")
    print(f"[시간측정] 커버 생성(자식 프로세스 전체): {time.time() - cover_start:.1f}초")
    for line in result.stdout.splitlines():
        if "[시간측정]" in line:
            print(f"  [커버 내부] {line}")

    return save_path

def embed_cover_into_audio(wav_path: str, cover_path: str) -> str:
    """
    wav 파일을 mp3로 변환하면서, 동시에 앨범 커버 이미지를 파일 안에 심는 함수.
    (WAV는 커버 이미지를 넣는 표준 방법이 없어서, MP3의 ID3 태그 방식을 이용함)

    ffmpeg 명령어 구조:
    -i wav_path   : 오디오 입력
    -i cover_path : 이미지 입력
    -map 0:a      : 오디오 스트림만 가져옴 (0번째 입력의 audio)
    -map 1:v      : 이미지 스트림만 가져옴 (1번째 입력의 video/image)
    -c:a libmp3lame -q:a 2 : mp3로 인코딩 (품질 2 = 고음질)
    -c:v png -disposition:v attached_pic : 이미지를 "첨부 이미지"(커버아트)로 표시
    -id3v2_version 3 : 대부분의 플레이어(윈도우 미디어 플레이어 포함)가 인식하는 ID3 태그 버전

    반환값: 최종 mp3 파일 경로
    """
    mp3_path = wav_path.rsplit(".", 1)[0] + ".mp3"

    command = [
        "ffmpeg", "-y",  # -y: 같은 이름 파일 있으면 덮어쓰기
        "-i", wav_path,
        "-i", cover_path,
        "-map", "0:a",
        "-map", "1:v",
        "-c:a", "libmp3lame", "-q:a", "2",
        "-c:v", "png",
        "-disposition:v", "attached_pic",
        "-id3v2_version", "3",
        mp3_path
    ]

    result = subprocess.run(command, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"[ffmpeg 에러] {result.stderr}")
        raise RuntimeError("mp3 변환+커버 삽입 실패 - ffmpeg 설치 여부 확인 필요")

    # mp3 변환 성공했으면 원본 wav는 이제 필요 없음 (중간 산출물이라 지워서 용량 절약)
    if os.path.exists(wav_path):
        os.remove(wav_path)
        print(f"[정리] 원본 wav 삭제됨: {wav_path}")

    print(f"[mp3 변환] 저장 완료: {mp3_path}")
    return mp3_path


def _sanitize_filename(title: str) -> str:
    """
    노래 제목을 파일 이름으로 써도 안전하게 다듬는 함수.

    왜 필요한지: 윈도우 파일명은 \\ / : * ? " < > | 같은 특수문자를 못 씀.
    제목이 없거나 다듬고 나니 빈 문자열이면 그냥 랜덤 이름으로 대체.
    끝에 짧은 uuid를 붙이는 이유: 같은 제목으로 여러 번 생성해도 파일이 안 겹치게 하기 위함.
    """
    if not title:
        return uuid.uuid4().hex

    safe = re.sub(r'[\\/:*?"<>|]', '', title).strip()
    safe = safe.replace(' ', '_')

    if not safe:
        return uuid.uuid4().hex

    return f"{safe}_{uuid.uuid4().hex[:6]}"


def build_prompt_tags(genres: list, instruments: list = None,
                       emotions: list = None, versions: list = None) -> str:
    """
    선택된 장르/악기/감정/버전(각각 여러개 가능) -> ACE-Step용 프롬프트 문자열로 합치는 함수.

    versions: 보컬 스타일 다중 선택 (예: ["남자 그룹"], ["남녀 듀엣"] 등)
    매핑표에 없는 값이 와도 원문 그대로 태그에 넣음 (장르/악기/감정과 동일한 방식 -
    예전엔 여기만 매핑 없으면 조용히 버려져서 선택해도 아무 효과 없었던 버그가 있었음)
    """
    instruments = instruments or []
    emotions = emotions or []
    versions = versions or []

    if not genres:
        genres = ["발라드"]

    tag_parts = []
    for idx, g in enumerate(genres):
        tag = GENRE_TAG_MAP.get(g, g)
        if idx > 0:
            tag = ", ".join(part for part in tag.split(", ") if "bpm" not in part)
        tag_parts.append(tag)

    for inst in instruments:
        inst_tag = INSTRUMENT_TAG_MAP.get(inst, inst)
        tag_parts.append(inst_tag)

    for emo in emotions:
        emo_tag = EMOTION_TAG_MAP.get(emo, emo)
        tag_parts.append(emo_tag)

    for ver in versions:
        ver_tag = VOCAL_TAG_MAP.get(ver, ver)
        tag_parts.append(ver_tag)

    prompt = ", ".join(tag_parts)
    return prompt[:500]  # ACE-Step caption 하드리밋 여유있게 컷


def generate_music(lyrics: str, genres: list, instruments: list = None,
                    emotions: list = None, versions: list = None,
                    reference_audio_path: str = None, duration: int = 60,
                    title: str = None, seed=None) -> str:
    """
    ACE-Step 1.5 API로 실제 음악 생성.

    lyrics: [verse]/[chorus] 태그 포함된 가사
    genres / instruments / emotions / versions: 각각 사용자가 고른 리스트 (여러개 가능)
    versions: 보컬 스타일 다중 선택 (예: ["남자 그룹"], ["남녀 듀엣"])
    reference_audio_path: 레퍼런스로 쓸 곡의 파일 경로 (없으면 텍스트만으로 생성)
    duration: 곡 길이 (초)
    title: Gemini가 지어준 노래 제목 -> 저장 파일 이름으로 사용 (없으면 랜덤 이름)
    seed: 특정 시드값 고정 (미리듣기에서 고른 스타일 그대로 전체 길이로 만들 때 사용.
          None이면 랜덤 시드로 생성됨)

    동작 방식: 작업을 서버에 "제출"(release_task) -> 완료될 때까지 "확인"(query_result) 반복 -> 완성되면 파일 다운로드
    """
    music_start = time.time()   # 시간측정: 음악 생성 시작

    prompt_tags = build_prompt_tags(genres, instruments, emotions, versions)

    form_data = {
        "caption": prompt_tags,
        "lyrics": lyrics,
        "duration": duration,
        "inference_steps": 8,   # turbo 모델 권장값
        "thinking": True,       # 5Hz LM으로 가사-음악 타이밍 설계 (가사 순서 맞추는 핵심 옵션)
    }
    if seed is not None:
        form_data["seed"] = seed

    if reference_audio_path:
        with open(reference_audio_path, "rb") as f:
            files = {"reference_audio": f}
            submit_response = requests.post(f"{ACE_API_URL}/release_task", data=form_data, files=files)
    else:
        submit_response = requests.post(f"{ACE_API_URL}/release_task", json=form_data)

    submit_response.raise_for_status()
    task_id = submit_response.json()["data"]["task_id"]
    print(f"[ACE-Step] 작업 제출됨: {task_id}")

    for _ in range(450):
        time.sleep(2)
        poll_response = requests.post(f"{ACE_API_URL}/query_result", json={"task_id_list": [task_id]})
        poll_response.raise_for_status()

        entry = poll_response.json()["data"][0]
        status = entry["status"]

        if status == 1:   # 성공
            result = json.loads(entry["result"])[0]
            audio_path_on_server = result["file"]
            break
        elif status == 2:   # 실패
            raise RuntimeError(f"ACE-Step 생성 실패: {entry}")
    else:
        raise TimeoutError("5분 넘게 기다렸는데도 생성이 안 끝남 - 서버 상태 확인 필요")

    audio_response = requests.get(f"{ACE_API_URL}{audio_path_on_server}")
    audio_response.raise_for_status()

    os.makedirs("output", exist_ok=True)
    filename = _sanitize_filename(title)
    save_path = f"output/{filename}.wav"
    with open(save_path, "wb") as f:
        f.write(audio_response.content)

    print(f"[ACE-Step] 저장 완료: {save_path}")
    print(f"[시간측정] 음악 생성: {time.time() - music_start:.1f}초")
    return save_path


def generate_preview_variations(lyrics: str, genres: list, instruments: list = None,
                                 emotions: list = None, versions: list = None,
                                 reference_audio_path: str = None,
                                 num_variations: int = 2, preview_duration: int = 20) -> list:
    """
    본 생성 전에 짧은(기본 20초) 샘플을 여러 개(기본 2개) 한 번에 만들어서
    사용자가 마음에 드는 스타일을 미리 들어보고 고를 수 있게 하는 함수.

    ACE-Step의 batch_size 기능을 이용해서 한 번의 요청으로 여러 변형을 동시에 생성함
    (하나씩 여러 번 요청하는 것보다 훨씬 빠름).

    reference_audio_path: 레퍼런스로 쓸 곡의 파일 경로 (generate_music()과 동일한 방식.
                           없으면 텍스트/태그만으로 생성)

    반환값: [{"path": "output/previews/xxx.wav", "seed": "12345"}, ...] 형태의 리스트
    각 항목의 seed를 나중에 generate_music()에 그대로 넘기면, 그 미리듣기와
    같은 스타일로 전체 길이 버전을 만들 수 있음.
    """
    prompt_tags = build_prompt_tags(genres, instruments, emotions, versions)

    form_data = {
        "caption": prompt_tags,
        "lyrics": lyrics,
        "duration": preview_duration,
        "inference_steps": 8,
        "thinking": True,
        "batch_size": num_variations,
    }

    if reference_audio_path:
        with open(reference_audio_path, "rb") as f:
            files = {"reference_audio": f}
            submit_response = requests.post(f"{ACE_API_URL}/release_task", data=form_data, files=files)
    else:
        submit_response = requests.post(f"{ACE_API_URL}/release_task", json=form_data)
    submit_response.raise_for_status()
    task_id = submit_response.json()["data"]["task_id"]
    print(f"[미리듣기] 작업 제출됨: {task_id} (변형 {num_variations}개)")

    for _ in range(450):
        time.sleep(2)
        poll_response = requests.post(f"{ACE_API_URL}/query_result", json={"task_id_list": [task_id]})
        poll_response.raise_for_status()

        entry = poll_response.json()["data"][0]
        status = entry["status"]

        if status == 1:   # 성공
            results = json.loads(entry["result"])  # 배치 전체 결과 리스트 (변형 개수만큼 들어있음)
            break
        elif status == 2:   # 실패
            raise RuntimeError(f"미리듣기 생성 실패: {entry}")
    else:
        raise TimeoutError("미리듣기 생성 5분 초과 - 서버 상태 확인 필요")

    # seed_value는 "12345,67890" 처럼 콤마로 구분된 문자열로 옴 (배치 순서와 대응됨)
    seed_str = results[0].get("seed_value", "") if results else ""
    seeds = [s.strip() for s in seed_str.split(",")] if seed_str else []

    os.makedirs("output/previews", exist_ok=True)
    previews = []
    for idx, item in enumerate(results):
        audio_response = requests.get(f"{ACE_API_URL}{item['file']}")
        audio_response.raise_for_status()

        preview_filename = f"preview_{uuid.uuid4().hex}.wav"
        save_path = f"output/previews/{preview_filename}"
        with open(save_path, "wb") as f:
            f.write(audio_response.content)

        seed = seeds[idx] if idx < len(seeds) else None
        previews.append({"path": save_path, "seed": seed})

    print(f"[미리듣기] {len(previews)}개 생성 완료")
    return previews


def run_pipeline(diary_text: str = None, image_path: str = None,
                  user_caption: str = "", selected_genres: list = None,
                  selected_instruments: list = None, selected_emotions: list = None,
                  selected_versions: list = None, reference_audio_path: str = None,
                  duration: int = 60) -> dict:
    """전체 파이프라인 실행 함수 (로컬 테스트용)"""
    lyrics_start = time.time()   # 시간측정: 가사 생성 시작
    if diary_text:
        lyrics_result = generate_lyrics_from_text(diary_text, duration)
    elif image_path:
        lyrics_result = generate_lyrics_from_photo(image_path, user_caption, duration)
    else:
        raise ValueError("diary_text 또는 image_path 둘 중 하나는 반드시 있어야 해")
    print(f"[시간측정] 가사 생성: {time.time() - lyrics_start:.1f}초")

    genres = selected_genres or [lyrics_result["genre_suggestions"][0]]
    instruments = selected_instruments or []
    emotions = selected_emotions or []
    versions = selected_versions or []
    title = lyrics_result.get("title")

    print(f"[제목] {title}")
    print(f"[감정 분석] {lyrics_result['emotion']}")
    print(f"[가사]\n{lyrics_result['lyrics']}")
    print(f"[선택된 장르] {genres}, [악기] {instruments}, [감정] {emotions}, [버전] {versions}")

    audio_path = generate_music(
        lyrics_result["lyrics"], genres, instruments, emotions, versions,
        reference_audio_path, duration, title
    )

    try:
        style = pick_style_from_emotion(lyrics_result["emotion"])
        cover_path = generate_album_cover_sdxl(
            title, lyrics_result["emotion"], genres, instruments,
            style=style, lyrics=lyrics_result["lyrics"]
        )
    except Exception as e:
        print(f"[앨범 커버] SDXL 실패, 그라데이션 방식으로 대체: {e}")
        cover_path = generate_album_cover(title, lyrics_result["emotion"], genres, instruments)

    return {
        "title": title,
        "emotion": lyrics_result["emotion"],
        "lyrics": lyrics_result["lyrics"],
        "genres": genres,
        "instruments": instruments,
        "emotions": emotions,
        "versions": versions,
        "audio_path": audio_path,
        "cover_path": cover_path
    }


if __name__ == "__main__":
    result = run_pipeline(
        diary_text="오늘 시험 결과가 안 좋아서 하루 종일 기분이 가라앉았다. 그래도 저녁에 친구랑 통화하니까 조금 나아졌다.",
        selected_genres=["발라드", "재즈"],
        selected_instruments=["색소폰"],
        selected_emotions=["그리움", "애잔함"],
        selected_versions=["여자 그룹"],
        duration=90
    )
    print(result)
