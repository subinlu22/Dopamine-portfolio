"use client";

import { useState, useEffect, useRef } from "react";

// 백엔드 서버 주소 - page.jsx와 동일한 방식 (환경변수로 오버라이드 가능)
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function MusicResult({
  visible,
  tracks,
  selectedSampleIds,
  onToggleSampleSelect,
  onSelectAllSamples,
  onGenerateFullVersion,
  generatingFull,
  onSaveToCalendar,
  onRegenerate,
  onCreateNew,
  onBackToCalendar,
}) {
  const [nowPlayingId, setNowPlayingId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playToken, setPlayToken] = useState(0);
  const [activeLineIndex, setActiveLineIndex] = useState(0); // 지금 부르고 있는 줄(강조 표시용)
  // AI 앨범 커버 - 트랙마다 화면에서만 덮어씌울 이미지 URL 저장 (id -> coverUrl)
  const [aiCoverOverrides, setAiCoverOverrides] = useState({});
  const [generatingCoverId, setGeneratingCoverId] = useState(null);
  const [coverGenError, setCoverGenError] = useState(null);
  const [selectedCoverStyle, setSelectedCoverStyle] = useState(null);
  const [showLyricsOverlay, setShowLyricsOverlay] = useState(false); // 가사 오버레이 표시 여부

  // ✅ 추가 (1): 표지 이미지 밝기 감지 결과 저장 (0~255, null이면 미측정/실패)
  const [coverBrightness, setCoverBrightness] = useState(null);

  const coverStyleOptions = [
    { key: null, label: "자동" },
    { key: "gradient", label: "그라디언트" },
    { key: "illustration", label: "일러스트" },
    { key: "film", label: "필름" },
    { key: "dreamy", label: "몽환" },
    { key: "poster", label: "포스터" },
    { key: "watercolor", label: "수채화" },
    { key: "minimal_line", label: "라인아트" },
    { key: "collage", label: "콜라주" },
    { key: "neon", label: "네온" },
  ];
  const audioRef = useRef(null);
  const lyricsBoxRef = useRef(null);
  const lineRefs = useRef([]);

  // 트랙의 실제 표시용 커버 URL
  // ⚠️ 임시 테스트 이미지 - 가사/제목 오버레이 색상 확인 끝나면 아래 줄로 복구:
  const getDisplayCoverUrl = (track) => aiCoverOverrides[track?.id] || track?.coverUrl || null;

  const handleGenerateAiCover = async (track) => {
    if (!track || generatingCoverId) return;
    setGeneratingCoverId(track.id);
    setCoverGenError(null);
    try {
      const cleanTitle = (track.label || "untitled").replace(/\s*Ver\.\d+$/, "");
      const emotionText = (track.options?.emotions || []).join(", ") || "emotional";

      const response = await fetch(`${API_BASE}/generate-cover-sdxl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          emotion: emotionText,
          genres: track.options?.genres || [],
          instruments: track.options?.instruments || [],
          style: selectedCoverStyle,
        }),
      });

      if (!response.ok) throw new Error(`서버 응답 오류 (${response.status})`);
      const data = await response.json();

      setAiCoverOverrides((prev) => ({
        ...prev,
        [track.id]: `${API_BASE}${data.cover_url}`,
      }));
    } catch (err) {
      console.error("AI 커버 생성 실패:", err);
      setCoverGenError("이미지 생성에 실패했어요. 다시 시도해주세요.");
    } finally {
      setGeneratingCoverId(null);
    }
  };

  const currentTrack = tracks.find((t) => t.id === nowPlayingId) || null;
  const sampleTracks = tracks.filter((t) => t.type === "sample");
  const allSelected =
    sampleTracks.length > 0 && sampleTracks.every((t) => selectedSampleIds.includes(t.id));

  // ✅ 추가 (2): 현재 표지 이미지의 밝기를 Canvas로 측정
  // (CORS 허용 안 된 이미지면 감지 실패 -> coverBrightness는 null로 남고, 아래 안전망 스타일로 대체됨)
  useEffect(() => {
    const url = getDisplayCoverUrl(currentTrack);
    if (!url) {
      setCoverBrightness(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 24; // 작게 샘플링해서 계산 가볍게 (무료, 브라우저 내장 기능, GPU/서버 사용 없음)
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
          total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        setCoverBrightness(total / (data.length / 4));
      } catch (err) {
        setCoverBrightness(null);
      }
    };
    img.onerror = () => setCoverBrightness(null);
    img.src = url;
  }, [currentTrack, aiCoverOverrides]);

  // 밝은 표지인지 판단 (150 기준, 취향껏 조절 가능) + 가사/제목 색상·그림자 결정
  const isLightCover = false;
  //const isLightCover = coverBrightness !== null && coverBrightness > 150;
  const lyricsTextColor = isLightCover ? "#1a1a1a" : "white";

// ✅ 수정: 그림자를 여러 겹으로 쌓고, 테두리 효과(WebkitTextStroke) 추가해서 입체감/대비 강화
const lyricsTextShadow = isLightCover
  ? "0 0 4px #fff, 0 0 8px #fff, 0 0 14px rgba(255,255,255,.9), 0 2px 6px rgba(0,0,0,.4)"
  : "0 0 4px #000, 0 0 8px #000, 0 2px 4px rgba(0,0,0,.9), 0 4px 14px rgba(0,0,0,.85)";

const lyricsTextStroke = isLightCover
  ? "1.5px rgba(255,255,255,.9)"
  : "1.5px rgba(0,0,0,.85)";

  useEffect(() => {
    if (nowPlayingId) return;
    const firstFull = tracks.find((t) => t.type === "full");
    if (firstFull) setNowPlayingId(firstFull.id);
  }, [tracks]);

  useEffect(() => {
    if (!nowPlayingId || !audioRef.current) return;
    const track = tracks.find((t) => t.id === nowPlayingId);
    if (!track) return;
    audioRef.current.src = track.url;
    if (playToken > 0) {
      audioRef.current.play().catch(() => {});
    }
  }, [nowPlayingId, playToken]);

  useEffect(() => {
    if (lyricsBoxRef.current) lyricsBoxRef.current.scrollTop = 0;
    setActiveLineIndex(0);
  }, [nowPlayingId, playToken]);

  useEffect(() => {
    const audioEl = audioRef.current;
    const lines = currentTrack?.lyrics || [];
    if (!audioEl || lines.length === 0) return;

    const INTRO_BUFFER = 0.06;
    const OUTRO_BUFFER = 0.04;

    const weights = lines.map((l) => Math.max(l.length, 3));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let cumulative = 0;
    const boundaries = weights.map((w) => {
      cumulative += w;
      return cumulative / totalWeight;
    });

    const handleTimeUpdate = () => {
      if (!audioEl.duration || isNaN(audioEl.duration)) return;
      const rawRatio = audioEl.currentTime / audioEl.duration;
      const usableRange = 1 - INTRO_BUFFER - OUTRO_BUFFER;
      const adjustedRatio = Math.max(0, Math.min(1, (rawRatio - INTRO_BUFFER) / usableRange));
      let idx = boundaries.findIndex((b) => adjustedRatio <= b);
      if (idx === -1) idx = lines.length - 1;
      setActiveLineIndex((prev) => (prev !== idx ? idx : prev));
    };

    audioEl.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      audioEl.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [nowPlayingId, playToken, currentTrack]);

  useEffect(() => {
    const container = lyricsBoxRef.current;
    const activeEl = lineRefs.current[activeLineIndex];
    if (!container || !activeEl) return;
    const target = activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
    container.scrollTo({ top: target, behavior: "smooth" });
  }, [activeLineIndex]);

  if (!visible) return null;

  const handleToggleCurrent = (track) => {
    if (nowPlayingId === track.id) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    setNowPlayingId(track.id);
    setPlayToken((p) => p + 1);
  };

  const handleDownloadTrack = (track) => {
    const a = document.createElement("a");
    a.href = track.url;
    a.download = `dopamine-${track.label.replace(/\s+/g, "")}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShowLyrics = (track) => {
  if (!track) return;
  // 이미 같은 트랙의 가사창이 열려있는 상태에서 다시 누르면 -> 닫기
  if (showLyricsOverlay && nowPlayingId === track.id) {
    setShowLyricsOverlay(false);
    return;
  }
  if (nowPlayingId !== track.id) {
    setNowPlayingId(track.id);
  }
  setShowLyricsOverlay(true);
};

  const boxStyle = {
    backgroundColor: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
    border: "0px solid rgba(255,255,255,0.2)",
    borderRadius: "16px",
    padding: "16px",
  };

  const iconBtnStyle = {
    width: "30px",
    height: "30px",
    borderRadius: "8px",
    border: "0px solid rgba(255,255,255,.2)",
    backgroundColor: "rgba(255,255,255,.08)",
    color: "white",
    fontSize: "13px",
    cursor: "pointer",
    flexShrink: 0,
    transition: "all 0.2s ease",
  };

  const textActionBtnStyle = {
    height: "52px",
    padding: "0 16px",
    borderRadius: "12px",
    border: "0px solid rgba(255,255,255,.2)",
    backgroundColor: "rgba(255,255,255,.08)",
    color: "white",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
    flexShrink: 0,
    whiteSpace: "nowrap",
    lineHeight: "1.3",
    transition: "all 0.2s ease",
  };

  const smallBtnStyle = {
    backgroundColor: "rgba(255,255,255,.1)",
    border: "0px solid rgba(255,255,255,.25)",
    borderRadius: "10px",
    color: "white",
    fontSize: "12px",
    fontWeight: "600",
    padding: "8px 12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  return (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 40,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      overflowY: "auto",
      animation: "screenFadeIn 0.35s ease-out",
    }}
  >
    {/* ✅ 추가: 가사 오버레이 전용 스크롤바 */}
    <style jsx>{`
      .lyrics-scroll {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, .6) transparent;
      }
      .lyrics-scroll::-webkit-scrollbar {
        width: 8px;
      }
      .lyrics-scroll::-webkit-scrollbar-track {
        background: transparent;
        border-radius: 16px;
      }
      .lyrics-scroll::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, .55);
        border-radius: 16px;
        border: 1px solid rgba(0, 0, 0, .2);
      }
      .lyrics-scroll::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, .75);
      }
          .mr-hover-btn {
    transition: filter 0.15s ease, transform 0.15s ease;
  }
  .mr-hover-btn:hover:not(:disabled) {
    filter: brightness(1.25);
    transform: translateY(-1px);
  }
    `}</style>

    <div
      style={{
        width: "100%",
        maxWidth: "1500px",
        display: "grid",
        gridTemplateColumns: "1.3fr 0.9fr",
        gap: "28px",
        alignItems: "stretch",
      }}
    >
      {/* LEFT */}
      <div
        style={{
          position: "relative",
          background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
            border: "0px solid rgba(255,255,255,.2)",
            borderRadius: "22px",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "760px",
          }}
        >
          {getDisplayCoverUrl(currentTrack) ? (
            <img
              src={getDisplayCoverUrl(currentTrack)}
              alt="앨범 커버"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%" }} />
          )}

          {/* 가사 오버레이 */}
          {showLyricsOverlay && currentTrack && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                padding: "24px",
              }}
            >
            
              <div
                style={{
                  position: "relative", // ✅ 스크림 위에 오도록
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                  flexShrink: 0,
                }}
              >
                <p
                  style={{
                    color: lyricsTextColor, // ✅ 수정 (3)
                    fontSize: "16px",
                    fontWeight: "700",
                    margin: 0,
                    textShadow: lyricsTextShadow, // ✅ 수정 (3)
                  }}
                >
                  {currentTrack.label}
                </p>
                <button
                  onClick={() => setShowLyricsOverlay(false)}
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    border: "none",
                    backgroundColor: "rgba(0,0,0,.45)",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  ✕
                </button>
              </div>
              <div
                ref={lyricsBoxRef}
                className="lyrics-scroll"
                style={{
                  position: "relative", // ✅ 스크림 위에 오도록
                  flex: 1,
                  overflowY: "auto",
                  textAlign: "center",
                  padding: "6px 4px",
                }}
              >
                {(currentTrack.lyrics || []).map((line, i) => (
                  <p
                    key={i}
                    style={{
                      color: lyricsTextColor, // ✅ 수정 (3)
                      fontSize: "19px",
                      fontWeight: "800",
                      margin: "14px 0",
                      textShadow: lyricsTextShadow, // ✅ 수정 (3)
                                        }}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT - 이하 기존 코드와 동일 (변경 없음) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* 트랙 리스트 */}
          <div
            style={{
              ...boxStyle,
              minHeight: "320px",
              maxHeight: "45vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <h4 style={{ color: "white", fontSize: "18px", fontWeight: "700", margin: 0 }}>
                생성된 트랙
              </h4>
              {coverGenError && (
                <p style={{ color: "#ff8a8a", fontSize: "14px", margin: "4px 0 0 0", width: "100%" }}>
                  {coverGenError}
                </p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", width: "100%" }}>
                <span style={{ color: "rgba(255,255,255,.5)", fontSize: "14px" }}>표지 스타일:</span>
                {coverStyleOptions.map((opt) => {
                  const isActive = selectedCoverStyle === opt.key;
                  return (
                    <button
                      key={opt.label}
                      className="mr-hover-btn"
                      onClick={() => setSelectedCoverStyle(opt.key)}
                      style={{
                        fontSize: "12px",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        border: isActive ? "0px solid rgba(108,99,255,.8)" : "0px solid rgba(255,255,255,.15)",
                        backgroundColor: isActive ? "rgba(108,99,255,.35)" : "rgba(255,255,255,.05)",
                        color: "white",
                        cursor: "pointer",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {sampleTracks.length > 0 && (
                  <button onClick={() => onSelectAllSamples(!allSelected)} style={smallBtnStyle}>
                    {allSelected ? "전체 해제" : "전체 선택"}
                  </button>
                )}
                {selectedSampleIds.length > 0 && (
                  <button
                    onClick={() => onGenerateFullVersion(selectedSampleIds)}
                    disabled={generatingFull}
                    style={{
                      ...smallBtnStyle,
                      backgroundColor: generatingFull ? "rgba(255,255,255,.08)" : "rgba(244,114,182,.25)",
                      border: generatingFull ? "0px solid rgba(255,255,255,.15)" : "0px solid rgba(244,114,182,.5)",
                      color: generatingFull ? "rgba(255,255,255,.4)" : "white",
                      cursor: generatingFull ? "not-allowed" : "pointer",
                    }}
                  >
                    {generatingFull ? "⏳ 풀버전 생성 중..." : `풀버전 만들기 (${selectedSampleIds.length})`}
                  </button>
                )}
              </div>
            </div>

            <div className="glass-scroll" style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", flex: 1 }}>
              {tracks.map((track) => {
                const isCurrent = track.id === nowPlayingId;
                const isRowPlaying = isCurrent && isPlaying;
                const isChecked = selectedSampleIds.includes(track.id);
                return (
                  <div
                    key={track.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "11px 16px",
                      borderRadius: "10px",
                      backgroundColor: isCurrent ? "rgba(108,99,255,.2)" : "rgba(255,255,255,.05)",
                      border: isCurrent ? "0px solid rgba(108,99,255,.5)" : "0px solid rgba(255,255,255,.12)",
                      transition: ".2s",
                    }}
                  >
                    <button
                    className="mr-hover-btn"
                      onClick={() => handleToggleCurrent(track)}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        border: "none",
                        backgroundColor: "rgba(255,255,255,.15)",
                        color: "white",
                        cursor: "pointer",
                        fontSize: "13px",
                        flexShrink: 0,
                      }}
                    >
                      {isRowPlaying ? "♬" : "▶"}
                    </button>

                    {getDisplayCoverUrl(track) ? (
                      <img
                        src={getDisplayCoverUrl(track)}
                        alt=""
                        style={{
                          width: "52px",
                          height: "52px",
                          borderRadius: "6px",
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "52px",
                          height: "52px",
                          borderRadius: "6px",
                          backgroundColor: "rgba(255,255,255,.1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px",
                          flexShrink: 0,
                        }}
                      >
                        {track.type === "full" ? "💿" : "🎧"}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "white", fontSize: "15px", fontWeight: "600", margin: "0 0 4px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {track.label}
                      </p>
                      <p style={{ color: "rgba(255,255,255,.55)", fontSize: "14px", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {track.options?.genres?.slice(0, 2).join(", ")}
                      </p>
                    </div>

                    {track.type === "full" && (
                      <button
                        className="mr-hover-btn"
                        onClick={() => handleGenerateAiCover(track)}
                        disabled={generatingCoverId === track.id}
                        style={{
                          ...textActionBtnStyle,
                          opacity: generatingCoverId === track.id ? 0.5 : 1,
                          cursor: generatingCoverId === track.id ? "default" : "pointer",
                        }}
                      >
                        {generatingCoverId === track.id ? (
                          "생성 중..."
                        ) : (
                          <>표지<br />생성</>
                        )}
                      </button>
                    )}
                    <button
                      className="mr-hover-btn"
                      onClick={() => handleShowLyrics(track)}
                      disabled={!(track.lyrics && track.lyrics.length > 0)}
                      style={{
                        ...textActionBtnStyle,
                        opacity: track.lyrics && track.lyrics.length > 0 ? 1 : 0.4,
                        cursor: track.lyrics && track.lyrics.length > 0 ? "pointer" : "default",
                      }}
                    >
                      가사<br />보기
                    </button>

                    {track.type === "sample" && (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleSampleSelect(track.id)}
                        style={{ width: "17px", height: "17px", cursor: "pointer", flexShrink: 0 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 플레이어 */}
          <div style={boxStyle}>
            <audio
              ref={audioRef}
              controls
              style={{ width: "100%" }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
          </div>

          {/* 선택된 트랙 옵션 태그 */}
          {currentTrack?.options && (
            <div style={{ ...boxStyle, display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "장르", items: currentTrack.options.genres, color: "#c084fc" },
                { label: "악기", items: currentTrack.options.instruments, color: "#60a5fa" },
                { label: "감정", items: currentTrack.options.emotions, color: "#4ade80" },
                { label: "버전", items: currentTrack.options.versions, color: "#fbbf24" },
              ].map(({ label, items, color }) => (
                <div key={label} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.55)",
                      fontSize: "12px",
                      fontWeight: "700",
                      minWidth: "36px",
                      marginTop: "4px",
                    }}
                  >
                    {label}
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {(items || []).map((item) => (
                      <span
                        key={item}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          color: "white",
                          backgroundColor: `${color}33`,
                          border: `0px solid ${color}66`,
                        }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 다운로드 + 캘린더 저장 */}
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => currentTrack && handleDownloadTrack(currentTrack)}
              disabled={!currentTrack}
              style={{
                flex: 1,
                height: "56px",
                borderRadius: "12px",
                backgroundColor: "rgba(76, 175, 80, 0.25)",
                backdropFilter: "blur(10px)",
                border: "none",
                color: "white",
                fontSize: "15px",
                fontWeight: "600",
                cursor: currentTrack ? "pointer" : "not-allowed",
                opacity: currentTrack ? 1 : 0.5,
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                if (currentTrack) e.target.style.backgroundColor = "rgba(76, 175, 80, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "rgba(76, 175, 80, 0.25)";
              }}
            >
              다운로드
            </button>
            <button
              onClick={() => currentTrack && onSaveToCalendar({ ...currentTrack, coverUrl: getDisplayCoverUrl(currentTrack) })}
              disabled={!currentTrack}
              style={{
                flex: 1,
                height: "56px",
                borderRadius: "12px",
                backgroundColor: "rgba(244,114,182,0.25)",
                backdropFilter: "blur(10px)",
                border: "none",
                color: "white",
                fontSize: "15px",
                fontWeight: "600",
                cursor: currentTrack ? "pointer" : "not-allowed",
                opacity: currentTrack ? 1 : 0.5,
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                if (currentTrack) e.target.style.backgroundColor = "rgba(244,114,182,0.4)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "rgba(244,114,182,0.25)";
              }}
            >
              캘린더에 저장
            </button>
          </div>

          {/* 다시 만들기 / 새로 만들기 */}
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={onRegenerate}
              style={{
                flex: 1,
                height: "52px",
                borderRadius: "12px",
                background: "rgba(255,255,255,.08)",
                backdropFilter: "blur(10px)",
                border: "none",
                color: "white",
                fontSize: "15px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "rgba(255,255,255,.15)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "rgba(255,255,255,.08)";
              }}
            >
              같은 옵션으로 다시 생성
            </button>
            <button
              onClick={onCreateNew}
              style={{
                flex: 1,
                height: "52px",
                borderRadius: "12px",
                background: "rgba(108,99,255,.25)",
                backdropFilter: "blur(10px)",
                border: "none",
                color: "white",
                fontSize: "15px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "rgba(108,99,255,.4)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "rgba(108,99,255,.25)";
              }}
            >
              새로 만들기
            </button>
          </div>

          <button
            onClick={onBackToCalendar}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,.6)",
              cursor: "pointer",
              fontSize: "14px",
              marginTop: "4px",
            }}
          >
            캘린더로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}