# generate_cover_standalone.py
# SDXL 앨범 커버 생성 - 독립 실행 전용 스크립트
#
# 왜 이 파일이 따로 있는지 (중요):
# SDXL을 백엔드(uvicorn) 프로세스 안에서 직접 돌리면, torch.cuda.empty_cache()를 해도
# CUDA 컨텍스트(기본 예약분)는 프로세스가 살아있는 한 절대 GPU에서 반환되지 않음.
# 그래서 커버를 한 번이라도 만들면 백엔드가 GPU 메모리 일부를 영구 점유하게 되고,
# 그 다음 ACE-Step이 노래를 만들 때 VRAM이 부족해져서 느려지거나 타임아웃이 났음.
#
# 해결: 커버 생성을 이 스크립트로 완전히 분리해서, 매번 "새 프로세스로 실행 -> 커버 저장 ->
# 프로세스 완전 종료" 순서로 돌림. 프로세스가 종료되면 CUDA 컨텍스트까지 포함해
# GPU 메모리가 OS에 100% 반환됨 (OS 레벨 보장이라 가장 확실한 방법).
#
# 사용법 (full_pipeline.py가 subprocess로 호출함):
#   python generate_cover_standalone.py --title "제목" --emotion "감정" \
#       --genres '["발라드"]' --instruments '["피아노"]' --style "gradient" \
#       --lyrics "가사 전체 텍스트" --output "저장경로.png"
#
# 성공하면 stdout 마지막 줄에 "COVER_SAVED:저장경로"를 출력하고 종료코드 0으로 끝남.
#
# ===== 2026.07.15 변경사항 =====
# 1. 시간측정 로그 추가 (모델 로딩 / 이미지 생성 / 전체 각각 터미널에 [시간측정]으로 표시)
# 2. 제목+가사에서 시각 키워드를 뽑아 프롬프트에 반영 (예: 제목에 "별"이 있으면
#    starry night sky 키워드가 자동으로 프롬프트에 추가됨 -> 가사/제목 분위기와
#    더 어울리는 이미지가 나오게 하기 위함)

import argparse
import json
import os
import random
import sys
import time


# 스타일마다 고정 문구 하나가 아니라 여러 후보를 두고 매번 랜덤으로 하나 골라서 씀.
# (예전엔 "film"이 항상 "camera" 언급 -> 매번 카메라 물체가 나옴,
#  "dreamy"가 항상 "blurred" 언급 -> 매번 흐릿하기만 한 문제가 있었음.
#  후보를 늘려서 같은 스타일이어도 사물/구도가 다양하게 나오게 함)
COVER_STYLE_VARIANTS = {
    "gradient": [
        "minimalist abstract gradient art, smooth color blending, modern geometric shapes",
        "abstract flowing gradient waves, soft color transitions, minimal composition",
        "layered abstract gradient shapes, clean modern color blocks",
    ],
    "illustration": [
        "soft illustration style, hand-drawn feel, warm painterly textures, gentle brush strokes",
        "whimsical illustration, delicate watercolor texture, soft line art",
        "cozy illustrated still life, warm painterly colors, gentle shading",
    ],
    "film": [
        "vintage photographic aesthetic, fine grainy texture, faded nostalgic warm tones",
        "retro polaroid photograph aesthetic, warm faded tones, soft vignette",
        "vintage vinyl record and cassette tape still life, warm nostalgic lighting",
        "old analog camera resting on a wooden table, vintage warm tones, nostalgic still life",
        "faded vintage postcard aesthetic, muted retro color palette, soft grain",
    ],
    "dreamy": [
        "soft surreal atmosphere, gentle pastel color palette, warm glowing light",
        "dreamy pastel clouds, soft floating petals, gentle morning light",
        "ethereal starry night sky, soft glowing moonlight, pastel colors",
        "gentle mist over pastel colored hills, soft morning haze",
        "delicate floating lanterns, warm pastel glow, calm night atmosphere",
    ],
    "poster": [
        "bold pop art poster style, vibrant high contrast colors, graphic shapes",
        "retro travel poster style, bold flat colors, geometric shapes",
        "bold geometric poster art, saturated colors, striking composition",
    ],
    "watercolor": [
        "delicate watercolor painting, soft wet-on-wet technique, gentle color bleeding",
        "loose watercolor sketch, artistic paint splashes, dreamy translucent layers",
        "soft watercolor wash, muted pastel tones, organic paint texture",
    ],
    "minimal_line": [
        "single continuous line art, minimalist black and white sketch, elegant simplicity",
        "delicate line drawing, negative space composition, subtle single-color accent",
        "fine line illustration, clean minimalist composition, understated elegance",
    ],
    "collage": [
        "vintage paper collage aesthetic, torn paper edges, mixed media texture",
        "scrapbook style collage, layered paper cutouts, handmade craft feel",
        "retro cut-paper collage, layered textures, nostalgic handmade look",
    ],
    "neon": [
        "neon glow aesthetic, vibrant cyberpunk colors, glowing light trails",
        "retro synthwave neon, vivid pink and blue lighting, night city glow",
        "electric neon signage aesthetic, glowing outlines, vivid night colors",
    ],
}    

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


# ===== 신규 추가: 제목/가사 시각 키워드 사전 =====
# 한글 단어가 텍스트 안에 있으면, 매칭되는 영어 시각 요소를 프롬프트에 추가함.
# (예: "별빛 아래 소원" -> "별" 매칭 -> "starry night sky, twinkling stars" 추가)
KEYWORD_VISUAL_MAP = {
    "별": "starry night sky, twinkling stars",
    "달": "moonlight, crescent moon glow",
    "해": "warm sunshine, golden sunlight",
    "노을": "sunset glow, warm orange sky",
    "새벽": "dawn light, early morning mist",
    "비": "rain, wet window with raindrops",
    "눈": "falling snow, snowy quiet landscape",
    "바람": "gentle wind, swaying grass",
    "바다": "ocean waves, calm seaside horizon",
    "강": "flowing river, riverside scenery",
    "꽃": "blooming flowers in soft light",
    "봄": "spring blossoms, soft pastel green",
    "여름": "summer greenery, bright warm light",
    "가을": "autumn leaves, warm orange foliage",
    "겨울": "cold quiet winter scenery",
    "구름": "soft clouds, open sky",
    "안개": "soft morning fog, hazy scenery",
    "길": "quiet empty path, gentle road scenery",
    "창문": "window with soft light, cozy interior",
    "커피": "warm coffee cup, cozy cafe corner",
    "편지": "old letter, handwritten note aesthetic",
    "사진": "vintage photograph, faded memory aesthetic",
    "기차": "train window view, travel scenery",
    "우산": "umbrella in the rain, soft rainy mood",
    "불빛": "warm glowing lights, soft city lights",
    "골목": "quiet narrow alley, warm streetlight",
    "하늘": "wide open sky, soft clouds",
    "숲": "quiet forest, soft filtered sunlight",
    "산": "distant mountains, calm scenery",
    "집": "cozy warm home interior",
}


def extract_visual_keywords(text: str) -> list:
    """
    제목+가사 텍스트에서 매핑된 단어를 찾아 영어 시각 요소로 변환.
    너무 많이 넣으면 이미지가 산만해지므로 최대 2개까지만 사용.
    """
    if not text:
        return []
    found = []
    for kr_word, en_desc in KEYWORD_VISUAL_MAP.items():
        if kr_word in text:
            found.append(en_desc)
        if len(found) >= 2:
            break
    return found


def genres_to_english(genres):
    """한글 장르 리스트 -> 영어 설명 (매핑 없으면 emotional로 안전 대체)"""
    if not genres:
        return "emotional"
    mapped = [GENRE_EN_MAP.get(g, "emotional") for g in genres[:2]]
    return ", ".join(mapped)


def build_cover_prompt(title, emotion, genres, style, lyrics=""):
    """
    앨범 커버용 영어 프롬프트 조립 - 스타일별 여러 후보 중 랜덤으로 하나 선택.
    제목+가사에서 뽑은 시각 키워드도 함께 반영해서, 곡 내용과 더 어울리는 이미지가 나오게 함.
    """
    genre_desc = genres_to_english(genres)
    variants = COVER_STYLE_VARIANTS.get(style, COVER_STYLE_VARIANTS["gradient"])
    style_desc = random.choice(variants)

    # 제목 + 가사에서 시각 키워드 추출 (예: "별빛 아래 소원" -> "starry night sky")
    visual_keywords = extract_visual_keywords((title or "") + " " + (lyrics or ""))
    keyword_desc = ", " + ", ".join(visual_keywords) if visual_keywords else ""

    prompt = (
        f"album cover art, {style_desc}, {genre_desc} music mood, "
        f"emotion of {emotion}{keyword_desc}, professional album artwork, "
        f"peaceful empty scenery, abstract composition, meaningful everyday objects, "
        f"cozy atmosphere, no people, no humans, no characters, no animals, no creatures, "
        f"high quality, artistic, no text, no words, no letters, no logos"
    )
    return prompt


def main():
    import time
    total_start = time.time()   # 시간측정: 전체 시작

    parser = argparse.ArgumentParser()
    parser.add_argument("--title", default="untitled")
    parser.add_argument("--emotion", default="emotional")
    parser.add_argument("--genres", default="[]")       # JSON 문자열
    parser.add_argument("--instruments", default="[]")  # JSON 문자열 (현재 프롬프트엔 미사용, 인터페이스 호환용)
    parser.add_argument("--style", default="gradient")
    parser.add_argument("--lyrics", default="")          # 신규: 가사 전체 텍스트 (시각 키워드 추출용)
    parser.add_argument("--output", required=True)      # 저장할 png 전체 경로
    args = parser.parse_args()

    genres = json.loads(args.genres)

    # torch/diffusers는 여기(자식 프로세스)에서만 import - 부모(백엔드)는 GPU를 아예 안 건드림
    import torch
    from diffusers import AutoPipelineForText2Image

    print("[커버 프로세스] SDXL 모델 로딩 중...")
    load_start = time.time()   # 시간측정: 모델 로딩 시작
    pipe = AutoPipelineForText2Image.from_pretrained(
        "stabilityai/sdxl-turbo",
        torch_dtype=torch.float16,
        variant="fp16",
    )
    pipe = pipe.to("cuda")
    print(f"[시간측정] 모델 로딩: {time.time() - load_start:.1f}초")
    print("[커버 프로세스] 모델 로딩 완료, 이미지 생성 시작")

    prompt = build_cover_prompt(args.title, args.emotion, genres, args.style, args.lyrics)
    print(f"[커버 프로세스] 프롬프트: {prompt}")

    gen_start = time.time()   # 시간측정: 이미지 생성 시작
    image = pipe(
        prompt=prompt,
        num_inference_steps=2,   # Turbo는 1~4스텝이면 충분
        guidance_scale=0.0,      # Turbo 모델은 guidance 꺼야 정상 작동
        height=1024,
        width=1024,
    ).images[0]
    print(f"[시간측정] 이미지 생성: {time.time() - gen_start:.1f}초")

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    image.save(args.output)

    print(f"[시간측정] 커버 전체(로딩+생성): {time.time() - total_start:.1f}초")

    # 부모 프로세스(full_pipeline.py)가 이 줄을 파싱해서 성공 여부를 판단함
    print(f"COVER_SAVED:{args.output}")
    # 여기서 프로세스가 종료되면서 CUDA 컨텍스트 포함 GPU 메모리가 OS에 완전 반환됨


if __name__ == "__main__":
    main()
