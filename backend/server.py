# server.py
# Next.js 프론트가 호출할 백엔드 서버
# 실행: uvicorn server:app --reload --port 8000

import shutil
import uuid
import os
import json
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from lyrics_pipeline import generate_lyrics_from_text, generate_lyrics_from_photo, generate_lyrics_from_inputs, needs_vocal_part_split, reformat_lyrics_for_group_vocals
from full_pipeline import generate_music, generate_album_cover, generate_album_cover_sdxl, pick_style_from_emotion, embed_cover_into_audio, generate_preview_variations

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://192.168.22.19:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class LyricsFromTextRequest(BaseModel):
    diary_text: str
    duration: int = 60   # 노래 길이(초) - 가사 분량을 여기 맞춰서 생성


class CreateSongRequest(BaseModel):
    diary_text: str
    genres: List[str]
    instruments: List[str] = []
    emotions: List[str] = []
    versions: List[str] = []
    duration: int = 60   # 노래 길이(초), 프론트에서 안 보내면 기본 60초


@app.post("/generate-lyrics")
def generate_lyrics_endpoint(req: LyricsFromTextRequest):
    """
    텍스트 일기 입력 케이스.
    { diary_text, duration } 형태로 POST하면
    { title, emotion, lyrics, genre_suggestions } 반환
    """
    result = generate_lyrics_from_text(req.diary_text, req.duration)
    return result


@app.post("/generate-lyrics-from-photo")
async def generate_lyrics_photo_endpoint(
    photo: UploadFile = File(...),
    caption: str = Form(default=""),
    duration: int = Form(default=60)
):
    """
    사진 업로드 케이스.
    프론트에서 FormData로 photo 파일 + caption(선택) + duration(선택)을 같이 보내면
    { title, emotion, lyrics, genre_suggestions } 반환
    """
    temp_filename = f"temp_{uuid.uuid4().hex}_{photo.filename}"
    with open(temp_filename, "wb") as f:
        shutil.copyfileobj(photo.file, f)

    try:
        result = generate_lyrics_from_photo(temp_filename, caption, duration)
    finally:
        os.remove(temp_filename)

    return result


@app.post("/generate-music")
async def generate_music_endpoint(
    lyrics: str = Form(...),
    genres: str = Form(...),         # JSON 문자열로 온 리스트, 예: '["발라드"]'
    instruments: str = Form(default="[]"),
    emotions: str = Form(default="[]"),
    versions: str = Form(default="[]"),
    duration: int = Form(default=60),
    title: str = Form(default=""),
    seed: str = Form(default=""),
    already_reformatted: bool = Form(default=False),
    reference_audio: UploadFile = File(default=None),
    reuse_cover_filename: str = Form(default=""),
):
    """
    가사 미리보기 화면에서 사용자가 확인(또는 수정)한 최종 가사 + 장르/악기/감정/보컬/길이를 받아서
    바로 음악 생성. { audio_url } 반환 -> 프론트에서 <audio src={API_BASE + audio_url}>로 바로 재생 가능

    파일 업로드(레퍼런스 음악)가 껴있어서 JSON이 아니라 multipart/form-data로 받음
    (그래서 genres 같은 리스트도 JSON 문자열로 인코딩해서 보내야 함).

    그룹/듀엣 보컬(남자 그룹, 여자 그룹, 남녀 듀엣) 선택 시에는
    ACE-Step이 파트를 구분할 수 있게 가사를 한 번 더 재포맷함
    (일반 솔로 보컬이면 이 단계는 건너뛰고 원본 가사 그대로 사용).

    already_reformatted: 프론트가 /generate-previews에서 이미 재포맷된 가사를 그대로
    넘기는 경우 True로 보내면, 여기서 또 재포맷하지 않음 (이중 재포맷 방지 -
    안 그러면 미리듣기와 완성본의 가사/멜로디가 서로 달라지는 문제가 있었음).

    reuse_cover_filename: 같은 노래의 다른 버전(Ver.2 등)에서, 이미 만들어진 커버를
    그대로 재사용하고 싶을 때 그 파일명을 넘김. 넘기면 커버를 새로 안 만들고
    output/covers/{reuse_cover_filename}을 그대로 씀 (같은 곡 버전끼리 커버 통일 +
    SDXL/Pillow 중복 호출 절약 목적). 없으면 기존처럼 새로 생성.
    """
    genres_list = json.loads(genres)
    instruments_list = json.loads(instruments)
    emotions_list = json.loads(emotions)
    versions_list = json.loads(versions)

    final_lyrics = lyrics
    if needs_vocal_part_split(versions_list) and not already_reformatted:
        final_lyrics = reformat_lyrics_for_group_vocals(lyrics, versions_list)

    # 레퍼런스 음악 파일이 있으면 임시로 디스크에 저장 (ACE-Step API에 파일 경로로 넘기기 위함)
    reference_audio_path = None
    if reference_audio is not None:
        reference_audio_path = f"temp_{uuid.uuid4().hex}_{reference_audio.filename}"
        with open(reference_audio_path, "wb") as f:
            shutil.copyfileobj(reference_audio.file, f)

    try:
        audio_path = generate_music(
            final_lyrics, genres_list, instruments_list, emotions_list, versions_list,
            reference_audio_path=reference_audio_path,
            duration=duration, title=title or None, seed=seed or None
        )
    finally:
        if reference_audio_path and os.path.exists(reference_audio_path):
            os.remove(reference_audio_path)

    # 앨범 커버 생성 (또는 재사용)
    # (7/14 구조 변경) 노래 생성 단계에서는 항상 Pillow 그라데이션 방식만 씀 - 빠르고 100% 안정적.
    # SDXL로 만든 진짜 이미지는 완성 화면에서 "앨범 커버 만들기" 버튼을 눌렀을 때
    # 별도 엔드포인트(/generate-cover-sdxl)에서 생성해서 화면에만 반영함
    # (mp3 안에 박히는 커버는 이 기본 Pillow 이미지 그대로 - 다운로드 파일 재인코딩 없음).
    reused = False
    if reuse_cover_filename:
        candidate_path = os.path.join("output", "covers", reuse_cover_filename)
        if os.path.exists(candidate_path):
            cover_path = candidate_path
            reused = True
        else:
            print(f"[앨범 커버] 재사용 대상 파일을 못 찾음({reuse_cover_filename}), 새로 생성함")

    if not reused:
        emotion_text = ", ".join(emotions_list) if emotions_list else "emotional"
        cover_path = generate_album_cover(title or "untitled", emotion_text, genres_list, instruments_list)
    cover_filename = os.path.basename(cover_path)

    # wav -> mp3 변환하면서 커버 이미지 심기
    final_audio_path = embed_cover_into_audio(audio_path, cover_path)
    final_filename = os.path.basename(final_audio_path)

    return {
        "audio_url": f"/audio/{final_filename}",
        "cover_url": f"/cover/{cover_filename}",
        "lyrics": final_lyrics
    }


@app.post("/generate-previews")
async def generate_previews_endpoint(
    lyrics: str = Form(...),
    genres: str = Form(...),
    instruments: str = Form(default="[]"),
    emotions: str = Form(default="[]"),
    versions: str = Form(default="[]"),
    num_variations: int = Form(default=2),
    preview_duration: int = Form(default=20),
    reference_audio: UploadFile = File(default=None),
):
    """
    본 생성 전에 짧은 샘플 여러 개를 미리 들려주는 엔드포인트.
    { previews: [{ preview_url, seed }, ...], lyrics } 반환.

    파일 업로드(레퍼런스 음악)가 껴있어서 JSON이 아니라 multipart/form-data로 받음.

    그룹/듀엣 보컬 선택 시에는 여기서도 미리 가사를 재포맷해서
    미리듣기 단계부터 파트 구분이 반영된 상태로 샘플을 만듦
    (안 그러면 미리듣기랑 실제 완성본이 다르게 나올 수 있음).

    사용자가 마음에 드는 걸 고르면, 그 seed + 재포맷된 lyrics를
    /generate-music 호출할 때 같이 넘겨서 같은 스타일/가사로
    전체 길이 곡을 만들면 됨 (이때 already_reformatted=true로 보내서 이중 재포맷 방지).
    """
    genres_list = json.loads(genres)
    instruments_list = json.loads(instruments)
    emotions_list = json.loads(emotions)
    versions_list = json.loads(versions)

    final_lyrics = lyrics
    if needs_vocal_part_split(versions_list):
        final_lyrics = reformat_lyrics_for_group_vocals(lyrics, versions_list)

    reference_audio_path = None
    if reference_audio is not None:
        reference_audio_path = f"temp_{uuid.uuid4().hex}_{reference_audio.filename}"
        with open(reference_audio_path, "wb") as f:
            shutil.copyfileobj(reference_audio.file, f)

    try:
        previews = generate_preview_variations(
            final_lyrics, genres_list, instruments_list, emotions_list, versions_list,
            reference_audio_path=reference_audio_path,
            num_variations=num_variations, preview_duration=preview_duration
        )
    finally:
        if reference_audio_path and os.path.exists(reference_audio_path):
            os.remove(reference_audio_path)

    return {
        "previews": [
            {"preview_url": f"/preview/{os.path.basename(p['path'])}", "seed": p["seed"]}
            for p in previews
        ],
        "lyrics": final_lyrics
    }


@app.get("/preview/{filename}")
def get_preview(filename: str):
    """미리듣기 샘플 wav 파일 서빙"""
    file_path = os.path.join("output", "previews", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="미리듣기 파일을 찾을 수 없어요")
    return FileResponse(file_path, media_type="audio/wav", filename=filename)


@app.post("/create-song")
def create_song_endpoint(req: CreateSongRequest):
    """
    프론트(캘린더 -> 음악만들기 흐름) 전용 통합 엔드포인트.
    일기 텍스트 -> 제목+가사 생성 -> 그 가사로 바로 음악 생성까지 한 번에 처리.
    duration을 가사 생성/음악 생성 양쪽에 다 넘겨서, 노래 길이에 맞는 가사 분량이 나오게 함.
    """
    lyrics_result = generate_lyrics_from_text(req.diary_text, req.duration)

    audio_path = generate_music(
        lyrics_result["lyrics"],
        req.genres,
        req.instruments,
        req.emotions,
        req.versions,
        duration=req.duration,
        title=lyrics_result.get("title"),
    )

    # 앨범 커버도 같이 생성
    # ⚠️ 임시 조치 (7/14): SDXL이 GPU를 오래 붙잡아서 ACE-Step 노래 생성이 타임아웃 나는 문제 확인 중.
    cover_path = generate_album_cover(
        lyrics_result.get("title") or "untitled",
        lyrics_result["emotion"],
        req.genres,
        req.instruments,
    )
    # --- SDXL 버전 (문제 해결되면 위로 바꾸기) ---
    # try:
    #     style = pick_style_from_emotion(lyrics_result["emotion"])
    #     cover_path = generate_album_cover_sdxl(
    #         lyrics_result.get("title") or "untitled",
    #         lyrics_result["emotion"],
    #         req.genres,
    #         req.instruments,
    #         style=style,
    #     )
    # except Exception as e:
    #     print(f"[앨범 커버] SDXL 실패, 그라데이션 방식으로 대체: {e}")
    #     cover_path = generate_album_cover(
    #         lyrics_result.get("title") or "untitled",
    #         lyrics_result["emotion"],
    #         req.genres,
    #         req.instruments,
    #     )
    cover_filename = os.path.basename(cover_path)

    # wav -> mp3 변환하면서 커버 이미지 심기 (미디어 플레이어에서 자동으로 커버 뜨게)
    final_audio_path = embed_cover_into_audio(audio_path, cover_path)
    final_filename = os.path.basename(final_audio_path)

    return {
        "audio_url": f"/audio/{final_filename}",
        "cover_url": f"/cover/{cover_filename}",
        "title": lyrics_result.get("title"),
        "lyrics": lyrics_result["lyrics"],
        "emotion": lyrics_result["emotion"],
    }


@app.post("/generate-lyrics-from-media")
async def generate_lyrics_from_media_endpoint(
    diary_text: str = Form(default=""),
    photo: UploadFile = File(default=None),
    audio: UploadFile = File(default=None),
    video: UploadFile = File(default=None),
    caption: str = Form(default=""),
    duration: int = Form(default=60),
):
    """
    가사 미리보기 화면 전용 엔드포인트.
    일기/사진/음성/영상 중 사용자가 고른 조합을 받아서 "가사만" 만들어 반환함
    (음악/커버는 아직 안 만듦 - 사용자가 가사 확인/수정하고 "음악 만들기" 누르면
    그때 /generate-music이 호출됨).

    diary_text, photo, audio, video 중 최소 하나는 있어야 함 - 여러 개 동시에 보내면
    Gemini가 그것들을 종합해서 하나의 감정/가사로 분석함.
    """
    temp_paths = {"image_path": None, "audio_path": None, "video_path": None}
    temp_files_to_clean = []

    try:
        if photo is not None:
            path = f"temp_{uuid.uuid4().hex}_{photo.filename}"
            with open(path, "wb") as f:
                shutil.copyfileobj(photo.file, f)
            temp_paths["image_path"] = path
            temp_files_to_clean.append(path)

        if audio is not None:
            path = f"temp_{uuid.uuid4().hex}_{audio.filename}"
            with open(path, "wb") as f:
                shutil.copyfileobj(audio.file, f)
            temp_paths["audio_path"] = path
            temp_files_to_clean.append(path)

        if video is not None:
            path = f"temp_{uuid.uuid4().hex}_{video.filename}"
            with open(path, "wb") as f:
                shutil.copyfileobj(video.file, f)
            temp_paths["video_path"] = path
            temp_files_to_clean.append(path)

        if not any(temp_paths.values()) and not diary_text:
            raise HTTPException(status_code=400, detail="diary_text, photo, audio, video 중 최소 하나는 필요해요")

        lyrics_result = generate_lyrics_from_inputs(
            diary_text=diary_text or None,
            image_path=temp_paths["image_path"],
            audio_path=temp_paths["audio_path"],
            video_path=temp_paths["video_path"],
            user_caption=caption,
            duration=duration,
        )
    finally:
        for path in temp_files_to_clean:
            if os.path.exists(path):
                os.remove(path)

    return lyrics_result  # { title, emotion, lyrics, genre_suggestions }


@app.post("/create-song-from-media")
async def create_song_from_media_endpoint(
    diary_text: str = Form(default=""),
    photo: UploadFile = File(default=None),
    audio: UploadFile = File(default=None),
    video: UploadFile = File(default=None),
    caption: str = Form(default=""),
    genres: str = Form(...),        # JSON 문자열로 온 리스트, 예: '["발라드","재즈"]'
    instruments: str = Form(default="[]"),
    emotions: str = Form(default="[]"),
    versions: str = Form(default="[]"),   # JSON 문자열로 온 리스트, 예: '["남자 아이돌"]'
    duration: int = Form(default=60),
):
    """
    사진/음성/영상 중 사용자가 선택한 조합(하나 이상)으로 노래를 만드는 통합 엔드포인트.
    파일 업로드가 껴있어서 JSON이 아니라 multipart/form-data로 받음
    (그래서 genres 같은 리스트도 JSON 문자열로 인코딩해서 보내야 함 - 프론트에서
     JSON.stringify(genres)로 만들어서 FormData에 넣으면 됨).

    diary_text, photo, audio, video 중 최소 하나는 있어야 함 - 여러 개 동시에 보내면
    Gemini가 그것들을 종합해서 하나의 감정/가사로 분석함.
    """
    genres_list = json.loads(genres)
    instruments_list = json.loads(instruments)
    emotions_list = json.loads(emotions)
    versions_list = json.loads(versions)

    # 업로드된 파일들을 임시로 디스크에 저장 (Gemini에 보내려면 파일 경로가 필요함)
    temp_paths = {"image_path": None, "audio_path": None, "video_path": None}
    temp_files_to_clean = []

    try:
        if photo is not None:
            path = f"temp_{uuid.uuid4().hex}_{photo.filename}"
            with open(path, "wb") as f:
                shutil.copyfileobj(photo.file, f)
            temp_paths["image_path"] = path
            temp_files_to_clean.append(path)

        if audio is not None:
            path = f"temp_{uuid.uuid4().hex}_{audio.filename}"
            with open(path, "wb") as f:
                shutil.copyfileobj(audio.file, f)
            temp_paths["audio_path"] = path
            temp_files_to_clean.append(path)

        if video is not None:
            path = f"temp_{uuid.uuid4().hex}_{video.filename}"
            with open(path, "wb") as f:
                shutil.copyfileobj(video.file, f)
            temp_paths["video_path"] = path
            temp_files_to_clean.append(path)

        if not any(temp_paths.values()) and not diary_text:
            raise HTTPException(status_code=400, detail="diary_text, photo, audio, video 중 최소 하나는 필요해요")

        lyrics_result = generate_lyrics_from_inputs(
            diary_text=diary_text or None,
            image_path=temp_paths["image_path"],
            audio_path=temp_paths["audio_path"],
            video_path=temp_paths["video_path"],
            user_caption=caption,
            duration=duration,
        )
    finally:
        # 분석 끝났으면 임시 파일 삭제 (디스크에 계속 쌓이지 않게)
        for path in temp_files_to_clean:
            if os.path.exists(path):
                os.remove(path)

    audio_path = generate_music(
        lyrics_result["lyrics"],
        genres_list,
        instruments_list,
        emotions_list,
        versions_list,
        duration=duration,
        title=lyrics_result.get("title"),
    )

    # ⚠️ 임시 조치 (7/14): SDXL이 GPU를 오래 붙잡아서 ACE-Step 노래 생성이 타임아웃 나는 문제 확인 중.
    cover_path = generate_album_cover(
        lyrics_result.get("title") or "untitled",
        lyrics_result["emotion"],
        genres_list,
        instruments_list,
    )
    # --- SDXL 버전 (문제 해결되면 위로 바꾸기) ---
    # try:
    #     style = pick_style_from_emotion(lyrics_result["emotion"])
    #     cover_path = generate_album_cover_sdxl(
    #         lyrics_result.get("title") or "untitled",
    #         lyrics_result["emotion"],
    #         genres_list,
    #         instruments_list,
    #         style=style,
    #     )
    # except Exception as e:
    #     print(f"[앨범 커버] SDXL 실패, 그라데이션 방식으로 대체: {e}")
    #     cover_path = generate_album_cover(
    #         lyrics_result.get("title") or "untitled",
    #         lyrics_result["emotion"],
    #         genres_list,
    #         instruments_list,
    #     )
    cover_filename = os.path.basename(cover_path)

    final_audio_path = embed_cover_into_audio(audio_path, cover_path)
    final_filename = os.path.basename(final_audio_path)

    return {
        "audio_url": f"/audio/{final_filename}",
        "cover_url": f"/cover/{cover_filename}",
        "title": lyrics_result.get("title"),
        "lyrics": lyrics_result["lyrics"],
        "emotion": lyrics_result["emotion"],
    }


@app.get("/audio/{filename}")
def get_audio(filename: str):
    """
    생성된 wav 파일을 브라우저에서 재생/다운로드할 수 있게 서빙하는 엔드포인트.
    프론트의 <audio src=...>, 다운로드 버튼이 이 경로를 통해 파일을 받아감.
    """
    file_path = os.path.join("output", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없어요")
    media_type = "audio/mpeg" if filename.lower().endswith(".mp3") else "audio/wav"
    return FileResponse(file_path, media_type=media_type, filename=filename)


@app.get("/cover/{filename}")
def get_cover(filename: str):
    """
    생성된 앨범 커버 이미지를 브라우저에서 보여줄 수 있게 서빙하는 엔드포인트.
    프론트에서 <img src={API_BASE + cover_url}>로 바로 표시 가능.
    """
    file_path = os.path.join("output", "covers", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없어요")
    return FileResponse(file_path, media_type="image/png", filename=filename)


class GenerateCoverSdxlRequest(BaseModel):
    title: str = "untitled"
    emotion: str = "emotional"
    genres: List[str] = []
    instruments: List[str] = []
    style: Optional[str] = None  # 프론트에서 사용자가 직접 스타일 고르면 여기로 옴 (없으면 감정 기반 자동 선택)


@app.post("/generate-cover-sdxl")
def generate_cover_sdxl_endpoint(req: GenerateCoverSdxlRequest):
    """
    완성 화면에서 "앨범 커버 만들기" 버튼 눌렀을 때 호출하는 전용 엔드포인트.
    노래 생성과 완전히 분리돼 있어서, 이걸 눌러도 ACE-Step 쪽엔 전혀 영향 없음.

    style: 프론트에서 사용자가 스타일(gradient/illustration/film/dreamy/poster)을
    직접 골라서 보내면 그걸 그대로 씀. 안 보내면(None) 감정 기반 자동 선택(pick_style_from_emotion).

    SDXL은 별도 프로세스(generate_cover_standalone.py)로 실행되고 끝나면 GPU를
    완전히 반환하므로, 여러 번 눌러도 GPU 메모리가 쌓이지 않음.

    참고: 여기서 만든 이미지는 화면 표시용(coverUrl)으로만 쓰임 - 이미 완성된
    mp3 파일 안에 박힌 커버(다운로드 파일)는 바뀌지 않음 (오디오 재인코딩 없음).
    """
    try:
        style = req.style or pick_style_from_emotion(req.emotion)
        cover_path = generate_album_cover_sdxl(req.title, req.emotion, req.genres, req.instruments, style=style)
    except Exception as e:
        print(f"[앨범 커버] SDXL 실패, 그라데이션 방식으로 대체: {e}")
        cover_path = generate_album_cover(req.title, req.emotion, req.genres, req.instruments)

    cover_filename = os.path.basename(cover_path)
    return {"cover_url": f"/cover/{cover_filename}"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
