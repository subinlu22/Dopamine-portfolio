// app/page.jsx
"use client";

import Calendar from "./components/calendar";
import RecordScreen from "./components/inputs/recordscreen";
import MusicGenerator from "./components/musicgenerator";
import MusicLoading from "./components/musicloading";
import MusicResult from "./components/musicresult";
import MusicError from "./components/musicerror";
import LyricsLoading from "./components/lyrics/LyricsLoading";
import LyricsResult from "./components/lyrics/LyricsResult";
import LyricsError from "./components/lyrics/LyricsError";
import { generateTrackLyrics } from "./components/utils/trackLyrics";

import { useState, useEffect, useRef } from "react";
import Header from "./components/header";
import Hero from "./components/hero";
import StartButton from "./components/startbutton";
import Footer from "./components/footer";

// 백엔드 서버 주소 - 환경변수(NEXT_PUBLIC_API_BASE)로 오버라이드 가능
// (내 컴퓨터는 기본값 localhost:8000 그대로 쓰고, 친구는 .env.local에
//  자기가 접속할 백엔드 주소만 넣으면 됨 - 코드는 안 건드려도 됨)
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// 친구가 ACE-Step/API키/네트워크 연결 없이도 화면을 볼 수 있게 하는 "가짜 모드" 스위치.
// 켜려면 .env.local에 NEXT_PUBLIC_USE_DUMMY=true 한 줄만 추가하면 됨 (코드는 안 건드림).
// 수빈 컴퓨터는 이 값이 없으니 항상 false -> 지금처럼 진짜 백엔드 그대로 사용.
const USE_DUMMY = process.env.NEXT_PUBLIC_USE_DUMMY === "true";

// 가짜 무음 오디오(wav)를 브라우저에서 직접 만들어서 Blob URL로 반환 - 서버 호출 전혀 없음
function generateDummyAudioUrl(seconds = 5) {
  const sampleRate = 8000;
  const numSamples = sampleRate * seconds;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);
  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

// 가짜 가사 - 실제 일기 내용 일부를 그대로 넣어서 그럴싸하게 보이게 함
function buildDummyLyrics(sourceItems) {
  const diaryItem = sourceItems.find((i) => i.type === "diary");
  const snippet = (diaryItem?.data || "오늘의 이야기").slice(0, 30);
  return `[verse]\n${snippet}\n그 순간이 자꾸 떠올라\n[chorus]\n우리 함께한 시간\n영원히 남을 거야`;
}

const Home = () => {
  const [showInput, setShowInput] = useState(false);
  const [showRecord, setShowRecord] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // entriesByDate[dateKey] = { records: [{id, diary, handwriting, voice, video}], music: url|null }

  const [entriesByDate, setEntriesByDate] = useState({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dopamine-entries-v2");
      if (saved) {
        setEntriesByDate(JSON.parse(saved));
      }
    } catch (err) {
      console.error("데이터 불러오기 실패:", err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("dopamine-entries-v2", JSON.stringify(entriesByDate));
    } catch (err) {
      console.error("데이터 저장 실패:", err);
    }
  }, [entriesByDate]);

  // 음악 생성 관련
  const [musicScreen, setMusicScreen] = useState(null); // null | "options" | "loading" | "result" | "error"
  const [musicGenKey, setMusicGenKey] = useState(0);
  const [selectedMusicOptions, setSelectedMusicOptions] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [selectedSampleIds, setSelectedSampleIds] = useState([]);
  const [generatingFull, setGeneratingFull] = useState(false);
  const [musicError, setMusicError] = useState(null);
  const generationIdRef = useRef(0);

  // 가사 생성 관련
  const [lyricsScreen, setLyricsScreen] = useState(null); // null | "loading" | "result" | "error"
  const [lyricsSourceItems, setLyricsSourceItems] = useState([]);
  const [generatedLyrics, setGeneratedLyrics] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState(null); // Gemini가 지어준 제목 (파일명/커버용)
  const [generatedEmotion, setGeneratedEmotion] = useState(null); // Gemini가 분석한 감정 (커버 밝기용)
  const [lyricsError, setLyricsError] = useState(null);
  const lyricsGenerationIdRef = useRef(0);

  const getDateKey = (date) => {
    if (!date) return null;
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const currentDateKey = getDateKey(selectedDate);

  const handleStart = () => {
    setShowInput(true);
  };

  const handleRecordClick = () => {
    if (!selectedDate) {
      alert("날짜를 선택해주세요!");
      return;
    }
    setShowRecord(true);
  };

  const handleRecordBack = () => {
    setShowRecord(false);
  };

  const handleSaveRecord = (record) => {
    if (!currentDateKey) return;
    setEntriesByDate((prev) => {
      const dayData = prev[currentDateKey] || { records: [], music: null };
      return {
        ...prev,
        [currentDateKey]: {
          ...dayData,
          records: [...dayData.records, record],
        },
      };
    });
    alert("저장되었습니다!");
    setShowRecord(false);
  };

  const handleDeleteField = (dateKey, recordId, field) => {
    if (!dateKey) return;
    setEntriesByDate((prev) => {
      const dayData = prev[dateKey];
      if (!dayData) return prev;

      const updatedRecords = dayData.records
        .map((r) => {
          if (r.id !== recordId) return r;
          const updated = { ...r };
          delete updated[field];
          return updated;
        })
        .filter((r) => r.diary || r.handwriting || r.voice || r.video);

      return {
        ...prev,
        [dateKey]: {
          ...dayData,
          records: updatedRecords,
        },
      };
    });
  };

  const handleUpdateDiary = (dateKey, recordId, newText) => {
    if (!dateKey) return;

    if (!newText.trim()) {
      handleDeleteField(dateKey, recordId, "diary");
      return;
    }

    setEntriesByDate((prev) => {
      const dayData = prev[dateKey];
      if (!dayData) return prev;

      const updatedRecords = dayData.records.map((r) =>
        r.id === recordId ? { ...r, diary: newText } : r
      );

      return {
        ...prev,
        [dateKey]: {
          ...dayData,
          records: updatedRecords,
        },
      };
    });
  };

  const handleDeleteMusic = (dateKey, musicId) => {
    if (!dateKey) return;
    setEntriesByDate((prev) => {
      const dayData = prev[dateKey];
      if (!dayData) return prev;

      const musicList = Array.isArray(dayData.music)
        ? dayData.music
        : dayData.music
        ? [{ id: "legacy", url: dayData.music }]
        : [];

      return {
        ...prev,
        [dateKey]: {
          ...dayData,
          music: musicList.filter((m) => m.id !== musicId),
        },
      };
    });
  };

  const handleInputBack = () => {
    setShowInput(false);
    setShowRecord(false);
    setSelectedDate(null);
    setCalendarDate(new Date());
    setMusicScreen(null);
    setTracks([]);
    setSelectedSampleIds([]);
    setSelectedMusicOptions(null);
    setLyricsScreen(null);
    setGeneratedLyrics("");
    setGeneratedTitle(null);
    setGeneratedEmotion(null);
    setLyricsSourceItems([]);
  };

  // ===== 음악 생성 (백엔드 실제 연결) =====
  // 가사는 이 시점에 이미 generatedLyrics에 있음 (LyricsResult 화면에서 확정/수정된 것).
  //
  // 흐름 변경 (7/13): 원래는 짧은 20초 미리듣기 2개 -> 하나 골라서 별도로 풀버전 생성
  // 이었는데, 미리듣기랑 실제 풀버전이 너무 다르게 나오는 문제가 있었음
  // (ACE-Step은 같은 seed라도 길이가 다르면 새로 생성하는 거라 "이어지는 일부"가 아님).
  // 그래서 처음부터 완성된 풀버전 2개(Ver.1, Ver.2)를 병렬로 만들어서 그중 고르는 방식으로 변경.
  // "둘 중에 선택하는 경험"은 그대로 유지하면서, 선택 후 다르게 나오는 문제 자체를 없앰.
  const generateMusic = async (musicOptions) => {
    const currentId = ++generationIdRef.current;
    setMusicError(null);

    // 가짜 모드 - 실제 서버 호출 없이 무음 오디오 2개로 화면만 채움
    if (USE_DUMMY) {
      await new Promise((r) => setTimeout(r, 800)); // 로딩 화면 잠깐 보여주기용
      if (generationIdRef.current !== currentId) return;
      const lyricsLines = generatedLyrics
        ? generatedLyrics.split("\n").map((l) => l.trim()).filter(Boolean)
        : [];
      const newTracks = [0, 1].map((idx) => ({
        id: `full-${Date.now()}-${idx + 1}`,
        type: "full",
        url: generateDummyAudioUrl(5),
        coverUrl: null,
        label: `${generatedTitle || "생성곡"} Ver.${idx + 1}`,
        options: musicOptions,
        lyricsText: generatedLyrics,
        lyrics: lyricsLines,
      }));
      setTracks(newTracks);
      setSelectedSampleIds([]);
      setMusicScreen("result");
      return;
    }

    const buildFormData = (reuseCoverFilename) => {
      const formData = new FormData();
      formData.append("lyrics", generatedLyrics);
      formData.append("genres", JSON.stringify(musicOptions.genres));
      formData.append("instruments", JSON.stringify(musicOptions.instruments));
      formData.append("emotions", JSON.stringify(musicOptions.emotions));
      formData.append("versions", JSON.stringify(musicOptions.versions || []));
      formData.append("duration", String(musicOptions.duration || 90));
      formData.append("title", generatedTitle || "");
      if (musicOptions.referenceFile) {
        formData.append("reference_audio", musicOptions.referenceFile);
      }
      if (reuseCoverFilename) {
        formData.append("reuse_cover_filename", reuseCoverFilename);
      }
      return formData;
    };

    try {
      // 풀버전 2개를 순서대로 요청 (seed를 안 넘기니까 서버가 매번 다른 시드를 써서
      // 자연스럽게 서로 다른 버전 2개가 나옴).
      // 예전엔 Promise.all로 동시에 쐈는데, 앨범 커버가 버전마다 따로 만들어져서
      // 같은 곡인데 커버가 서로 다르게 나오는 문제 + 이미지 생성이 중복되는 낭비가 있었음.
      // 그래서 Ver.1이 먼저 끝나면 그 커버 파일명을 Ver.2한테 넘겨서 재사용하게 함
      // (어차피 백엔드가 순차 처리라 동시 요청이어도 실제 대기 시간은 거의 같았음).
      const response1 = await fetch(`${API_BASE}/generate-music`, {
        method: "POST",
        body: buildFormData(),
      });
      if (!response1.ok) throw new Error(`서버 응답 오류 (${response1.status})`);
      const data1 = await response1.json();

      // cover_url은 "/cover/파일명.png" 형태라 마지막 "/" 뒤가 파일명
      const coverFilename = data1.cover_url ? data1.cover_url.split("/").pop() : "";

      const response2 = await fetch(`${API_BASE}/generate-music`, {
        method: "POST",
        body: buildFormData(coverFilename),
      });
      if (!response2.ok) throw new Error(`서버 응답 오류 (${response2.status})`);
      const data2 = await response2.json();

      const dataList = [data1, data2]; // 각각 { audio_url, cover_url, lyrics }

      if (generationIdRef.current !== currentId) return;

      const newTracks = dataList.map((data, idx) => {
        const lyricsLines = data.lyrics
          ? data.lyrics.split("\n").map((l) => l.trim()).filter(Boolean)
          : null;
        return {
          id: `full-${Date.now()}-${idx + 1}`,
          type: "full",
          url: `${API_BASE}${data.audio_url}`,
          coverUrl: data.cover_url ? `${API_BASE}${data.cover_url}` : null,
          label: `${generatedTitle || "생성곡"} Ver.${idx + 1}`,
          options: musicOptions,
          lyricsText: data.lyrics || generatedLyrics,
          lyrics: lyricsLines || generateTrackLyrics(musicOptions),
        };
      });

      setTracks(newTracks);
      setSelectedSampleIds([]);
      setMusicScreen("result");
    } catch (err) {
      if (generationIdRef.current !== currentId) return;
      console.error("음악 생성 실패:", err);
      setMusicError(err.message || "음악 생성 중 오류가 발생했습니다.");
      setMusicScreen("error");
    }
  };

  // 옵션(장르/악기/감정/보컬/길이) 선택 완료 -> 이제 이 정보를 바탕으로 가사를 생성함
  // (예전엔 여기서 바로 음악을 만들었는데, 노래 길이가 가사 분량에 반영이 안 되는
  //  문제가 있어서 순서를 바꿈: 옵션 먼저 -> 그 길이에 맞는 가사 생성 -> 확인 -> 음악 생성)
  const handleCreateMusic = (musicOptions) => {
    setSelectedMusicOptions(musicOptions);
    setMusicScreen(null);
    setLyricsScreen("loading");
    generateLyrics(lyricsSourceItems, musicOptions.duration);
  };

  const handleRegenerateMusic = () => {
    if (!selectedMusicOptions) return;
    setMusicScreen("loading");
    generateMusic(selectedMusicOptions);
  };

  const handleRetryMusic = () => {
    if (!selectedMusicOptions) return;
    setMusicScreen("loading");
    generateMusic(selectedMusicOptions);
  };

  const handleToggleSampleSelect = (sampleId) => {
    setSelectedSampleIds((prev) =>
      prev.includes(sampleId) ? prev.filter((id) => id !== sampleId) : [...prev, sampleId]
    );
  };

  const handleSelectAllSamples = (selectAll) => {
    const sampleIds = tracks.filter((t) => t.type === "sample").map((t) => t.id);
    setSelectedSampleIds(selectAll ? sampleIds : []);
  };

  // 선택한 샘플(들)의 seed + 가사를 그대로 /generate-music에 넘겨서
  // 같은 스타일의 전체 길이 곡으로 만듦 (실제 백엔드 호출)
  const handleGenerateFullVersion = async (sampleIds) => {
    const samples = tracks.filter((t) => sampleIds.includes(t.id));
    if (samples.length === 0) return;

    setGeneratingFull(true);
    try {
      const newFullTracks = await Promise.all(
        samples.map(async (sample) => {
          const formData = new FormData();
          formData.append("lyrics", sample.lyricsText);
          formData.append("genres", JSON.stringify(sample.options.genres));
          formData.append("instruments", JSON.stringify(sample.options.instruments));
          formData.append("emotions", JSON.stringify(sample.options.emotions));
          formData.append("versions", JSON.stringify(sample.options.versions || []));
          formData.append("duration", String(sample.options.duration || 90));
          formData.append("title", generatedTitle || "");
          formData.append("seed", sample.seed || "");
          // 미리듣기에서 이미 재포맷된 가사를 그대로 쓰는 거라, 서버에서 또 재포맷하지 않게 함
          // (이중 재포맷하면 미리듣기랑 완성본의 멜로디가 서로 달라지는 문제가 있었음)
          formData.append("already_reformatted", "true");
          if (sample.options.referenceFile) {
            formData.append("reference_audio", sample.options.referenceFile);
          }

          const response = await fetch(`${API_BASE}/generate-music`, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`서버 응답 오류 (${response.status})`);
          }

          const data = await response.json(); // { audio_url, cover_url, lyrics }

          const lyricsLines = data.lyrics
            ? data.lyrics.split("\n").map((l) => l.trim()).filter(Boolean)
            : sample.lyrics;

          return {
            id: `full-${sample.id}-${Date.now()}`,
            type: "full",
            url: `${API_BASE}${data.audio_url}`,
            coverUrl: data.cover_url ? `${API_BASE}${data.cover_url}` : null,
            label: `${generatedTitle || sample.label} 풀버전`,
            options: sample.options,
            lyricsText: data.lyrics || sample.lyricsText,
            lyrics: lyricsLines,
          };
        })
      );

      setTracks((prev) => [...prev, ...newFullTracks]);
      setSelectedSampleIds([]);
    } catch (err) {
      console.error("풀버전 생성 실패:", err);
      alert("풀버전 생성 중 오류가 발생했어요.");
    } finally {
      setGeneratingFull(false);
    }
  };

  const handleCreateNewMusic = () => {
    setTracks([]);
    setSelectedSampleIds([]);
    setMusicGenKey((prev) => prev + 1);
    setMusicScreen("options");
  };

  const handleSaveTrackToCalendar = (track) => {
  if (!currentDateKey) {
    alert("저장할 날짜를 먼저 선택해주세요!");
    return;
  }
  setEntriesByDate((prev) => {
    const dayData = prev[currentDateKey] || { records: [], music: [] };
    const existing = Array.isArray(dayData.music)
      ? dayData.music
      : dayData.music
      ? [{ id: "legacy", url: dayData.music, label: "생성된 음악", type: "legacy" }]
      : [];

    return {
      ...prev,
      [currentDateKey]: {
        ...dayData,
        music: [
          ...existing,
          {
            id: track.id,
            url: track.url,
            label: track.label,
            type: track.type,
            genres: track.options?.genres || [],
            lyrics: track.lyrics || [],   // 추가된 부분
            coverUrl: track.coverUrl || null,
            
          },
        ],
      },
    };
  });
  alert(`"${track.label}" 캘린더에 저장했어요!`);
};

  const handleBackToCalendarFromMusic = () => {
    setMusicScreen(null);
    setTracks([]);
    setSelectedSampleIds([]);
    setSelectedMusicOptions(null);
    setGeneratedLyrics("");
  };

  const handleCancelGeneration = () => {
    generationIdRef.current++;
    setMusicScreen("options");
  };

  const handleMusicErrorBack = () => {
    setMusicScreen("options");
  };

  const handleMusicGeneratorBack = () => {
    setMusicScreen(null);
  };

  // ===== 가사 생성 (백엔드 실제 연결) =====
  // base64 데이터 URL(사진/음성/영상)을 서버에 업로드 가능한 Blob으로 변환하는 헬퍼
  const dataURLtoBlob = (dataUrl) => {
    const [header, base64] = dataUrl.split(",");
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  };

  const generateLyrics = async (sourceItems, duration) => {
    const currentId = ++lyricsGenerationIdRef.current;
    setLyricsError(null);

    // 가짜 모드 - Gemini 호출 없이 바로 그럴싸한 가사로 채움
    if (USE_DUMMY) {
      await new Promise((r) => setTimeout(r, 500)); // 로딩 화면 잠깐 보여주기용
      if (lyricsGenerationIdRef.current !== currentId) return;
      setGeneratedLyrics(buildDummyLyrics(sourceItems));
      setGeneratedTitle("가짜 제목");
      setGeneratedEmotion("테스트 감정");
      setLyricsScreen("result");
      return;
    }

    try {
      const formData = new FormData();

      const diaryItem = sourceItems.find((i) => i.type === "diary");
      if (diaryItem) formData.append("diary_text", diaryItem.data);

      const photoItem = sourceItems.find((i) => i.type === "handwriting");
      if (photoItem) {
        formData.append("photo", dataURLtoBlob(photoItem.data), "photo.png");
      }

      const voiceItem = sourceItems.find((i) => i.type === "voice");
      if (voiceItem) {
        formData.append("audio", dataURLtoBlob(voiceItem.data), "voice.webm");
      }

      const videoItem = sourceItems.find((i) => i.type === "video");
      if (videoItem) {
        formData.append("video", dataURLtoBlob(videoItem.data), "video.webm");
      }

      // 노래 길이를 가사 생성 시점에 반영 -> Gemini가 그 길이에 맞는 분량으로 가사를 씀
      // (안 넘기면 서버 기본값 60초 기준으로 짧게 만들어져서, 나중에 긴 노래 길이를
      //  선택했을 때 가사는 짧고 노래는 길어 인트로/간주가 비정상적으로 길어지는 문제가 있었음)
      if (duration) formData.append("duration", String(duration));

      const response = await fetch(`${API_BASE}/generate-lyrics-from-media`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`서버 응답 오류 (${response.status})`);
      }

      const data = await response.json(); // { title, emotion, lyrics, genre_suggestions }

      if (lyricsGenerationIdRef.current !== currentId) return;

      setGeneratedLyrics(data.lyrics);
      setGeneratedTitle(data.title || null);
      setGeneratedEmotion(data.emotion || null);
      setLyricsScreen("result");
    } catch (err) {
      if (lyricsGenerationIdRef.current !== currentId) return;
      console.error("가사 생성 실패:", err);
      setLyricsError(err.message || "가사 생성 중 오류가 발생했습니다.");
      setLyricsScreen("error");
    }
  };

  // 일기/사진/음성/영상 항목 체크하고 "다음" 누르면 -> 이제 바로 가사 생성이 아니라
  // 장르/악기/감정/보컬/길이를 먼저 고르는 옵션 화면(MusicGenerator)부터 보여줌
  const handleGenerateLyrics = (sourceItems) => {
    setShowRecord(false);
    setLyricsSourceItems(sourceItems);
    setMusicGenKey((prev) => prev + 1);
    setMusicScreen("options");
  };

  const handleLyricsRetry = () => {
    setLyricsScreen("loading");
    generateLyrics(lyricsSourceItems, selectedMusicOptions?.duration);
  };

  const handleLyricsCancel = () => {
    lyricsGenerationIdRef.current++;
    setLyricsScreen(null);
  };

  const handleLyricsErrorBack = () => {
    setLyricsScreen(null);
  };

  const handleLyricsResultBack = () => {
    setLyricsScreen(null);
  };

  // 가사 확인 화면에서 "이전" 눌렀을 때 -> 캘린더까지 안 가고, 옵션(장르/악기/보컬/길이)
  // 선택 화면으로만 돌아감. MusicGenerator는 visible=false여도 컴포넌트 자체는 계속
  // 메모리에 남아있어서, 다시 보여주면 아까 골랐던 옵션이 그대로 남아있음.
  const handleLyricsBackToOptions = () => {
    setLyricsScreen(null);
    setMusicScreen("options");
  };

  const handleLyricsSave = (newText) => {
    setGeneratedLyrics(newText);
  };

  // LyricsResult에서 "이 가사로 음악 만들기" 누르면 -> 옵션은 이미 앞에서 다 골랐으니
  // 화면 왔다갔다 안 하고 바로 음악 생성(/generate-previews) 시작
  const handleCreateMusicFromLyrics = () => {
    setLyricsScreen(null);
    setMusicScreen("loading");
    generateMusic(selectedMusicOptions);
  };

  return (
    <main
      className="
        relative
        flex
        min-h-screen
        flex-col
        overflow-hidden

        bg-[url('/images/main1.jpg')]
        bg-cover
        bg-center
        bg-no-repeat
      "
    >
      <div className="absolute inset-0 bg-black/35"></div>

      {!showInput && (
        <div
          className="
            relative
            z-10
            flex
            min-h-screen
            flex-col
            items-center

            justify-center

            px-6
            pt-6
            pb-6
          "
          style={{ animation: "screenFadeIn 0.35s ease-out" }}
        >
          <h1
            style={{
              fontSize: "clamp(48px, 11vw, 150px)",
              fontWeight: 800,
              letterSpacing: "0.14em",
              color: "white",
              textAlign: "center",
              margin: 0,
              lineHeight: 1,
              textShadow:
                "0 0 40px rgba(102,217,255,.55), 0 0 90px rgba(102,217,255,.3)",
            }}
          >
            DOPAMINE
          </h1>

          <p
            style={{
              color: "rgba(255,255,255,.6)",
              fontSize: "13px",
              letterSpacing: "0.35em",
              marginTop: "18px",
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            오늘의 이야기를 노래로
          </p>

          <StartButton onStart={handleStart} />
        </div>
      )}

      <Calendar
        visible={showInput && !showRecord && !musicScreen && !lyricsScreen}
        calendarDate={calendarDate}
        setCalendarDate={setCalendarDate}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onBack={handleInputBack}
        entriesByDate={entriesByDate}
        onRecordClick={handleRecordClick}
        onDeleteField={handleDeleteField}
        onUpdateDiary={handleUpdateDiary}
        onDeleteMusic={handleDeleteMusic}
        onGenerateLyrics={handleGenerateLyrics}
      />

      <RecordScreen
        visible={showRecord && !lyricsScreen && !musicScreen}
        selectedDate={selectedDate}
        onBack={handleRecordBack}
        onSave={handleSaveRecord}
        onGenerateLyrics={handleGenerateLyrics}
      />

      {/* 가사 생성 화면들 */}
      <LyricsLoading visible={lyricsScreen === "loading"} onCancel={handleLyricsCancel} />
      <LyricsResult
        visible={lyricsScreen === "result"}
        lyricsText={generatedLyrics}
        onSave={handleLyricsSave}
        onCreateMusic={handleCreateMusicFromLyrics}
        onBackToOptions={handleLyricsBackToOptions}
        onBack={handleLyricsResultBack}
      />
      <LyricsError
        visible={lyricsScreen === "error"}
        errorMessage={lyricsError}
        onRetry={handleLyricsRetry}
        onBack={handleLyricsErrorBack}
      />

      {/* 음악 생성 화면들 */}
      <MusicGenerator
        key={musicGenKey}
        visible={musicScreen === "options"}
        onBack={handleMusicGeneratorBack}
        onCreateMusic={handleCreateMusic}
      />

      <MusicLoading visible={musicScreen === "loading"} onCancel={handleCancelGeneration} />

      <MusicResult
        visible={musicScreen === "result"}
        tracks={tracks}
        selectedSampleIds={selectedSampleIds}
        onToggleSampleSelect={handleToggleSampleSelect}
        onSelectAllSamples={handleSelectAllSamples}
        onGenerateFullVersion={handleGenerateFullVersion}
        generatingFull={generatingFull}
        onSaveToCalendar={handleSaveTrackToCalendar}
        onRegenerate={handleRegenerateMusic}
        onCreateNew={handleCreateNewMusic}
        onBackToCalendar={handleBackToCalendarFromMusic}
      />

      <MusicError
        visible={musicScreen === "error"}
        errorMessage={musicError}
        onRetry={handleRetryMusic}
        onBack={handleMusicErrorBack}
      />

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes screenFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        textarea::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .calendar-day-btn:hover {
          background-color: rgba(255,255,255,.15) !important;
          border-color: rgba(255,255,255,.3) !important;
        }

        .calendar-day-btn:focus,
        .calendar-day-btn:focus-visible {
          outline: none !important;
        }

        .record-card:hover .record-card-trash {
          opacity: 1 !important;
        }

        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: repeat(auto-fit"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
};

export default Home;
