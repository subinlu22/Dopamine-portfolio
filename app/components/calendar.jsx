"use client";

import { useState, useEffect, useMemo } from "react";

export default function Calendar({
  visible,
  calendarDate,
  setCalendarDate,
  selectedDate,
  onSelectDate,
  onBack,
  entriesByDate,
  onRecordClick,
  onDeleteField,
  onUpdateDiary,
  onDeleteMusic,
  onGenerateLyrics,
}) {
  const [preview, setPreview] = useState(null); // { type, data, recordId }
  const [isEditingDiary, setIsEditingDiary] = useState(false);
  const [editText, setEditText] = useState("");
  const [selectedItems, setSelectedItems] = useState({}); // key -> { type, data }

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const daysInMonth = getDaysInMonth(calendarDate);
  const firstDay = getFirstDayOfMonth(calendarDate);

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const typeColors = {
    diary: "#60a5fa",
    handwriting: "#4ade80",
    voice: "#c084fc",
    video: "#fb923c",
    music: "#f472b6",
  };

  const getDateKey = (date) => (date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : null);
  const selectedKey = getDateKey(selectedDate);
  const selectedDayData = selectedKey ? entriesByDate[selectedKey] || { records: [], music: [] } : { records: [], music: [] };
  const records = selectedDayData.records || [];
  const musicList = Array.isArray(selectedDayData.music)
    ? selectedDayData.music
    : selectedDayData.music
    ? [{ id: "legacy", url: selectedDayData.music, label: "생성된 음악" }]
    : [];

  // 날짜가 바뀌면 체크 상태 초기화
  useEffect(() => {
    setSelectedItems({});
  }, [selectedKey]);
  
  // 밝기 자동 감지 로직 제거 - 항상 흰 글씨 고정.
  // 참고: 그림자를 여러 겹(특히 blur 반경이 큰 겹)으로 쌓으면 글씨 테두리가 번져서
  // 흐릿하게 깨진 것처럼 보이는 문제가 있었음. 또한 소수점 stroke(0.6px)도 안티앨리어싱 때문에
  // 지글거리게 보일 수 있어서 제거함.
  // -> blur 없는 또렷한 그림자 2겹만 사용, stroke는 아예 안 씀.
const previewTextColor = "white";
const previewTextShadow = "0 1px 2px rgba(0,0,0,1), 0 2px 5px rgba(0,0,0,.9)";
const previewTextStroke = "0px transparent";

  const getFirstSentence = (text) => {
    if (!text) return "";
    const trimmed = text.trim();
    const match = trimmed.match(/^[^.!?\n]*[.!?]?/);
    const sentence = match ? match[0].trim() : trimmed;
    return sentence.length > 40 ? sentence.slice(0, 40) + "..." : sentence;
  };

  const menuBtnStyle = {
  width: "100%",
  height: "58px",
  borderRadius: "12px",
  backgroundColor: "rgba(255,255,255,.25)",
  backdropFilter: "blur(10px)",
  border: "none",
  color: "rgba(255,255,255,.9)",
  fontSize: "16px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all .3s ease",
  flexShrink: 0,
};

  const panelHeaderStyle = {
    color: "white",
    fontSize: "16px",
    fontWeight: "700",
    margin: 0,
  };

  const openPreview = (type, data, recordId, lyrics = null, coverUrl = null, label = null, memo = null) => {
  setPreview({ type, data, recordId, lyrics, coverUrl, label, memo });
  setIsEditingDiary(false);
  if (type === "diary") setEditText(data);
};

  const closePreview = () => {
    setPreview(null);
    setIsEditingDiary(false);
  };

  const handleSaveDiaryEdit = () => {
    if (!selectedKey || !preview) return;
    onUpdateDiary(selectedKey, preview.recordId, editText);
    setPreview({ ...preview, data: editText });
    setIsEditingDiary(false);
  };

  const toggleSelectItem = (key, type, data) => {
    setSelectedItems((prev) => {
      const updated = { ...prev };
      if (updated[key]) {
        delete updated[key];
      } else {
        updated[key] = { type, data };
      }
      return updated;
    });
  };

  const selectedCount = Object.keys(selectedItems).length;
  const monthStats = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const typeCounts = { diary: 0, handwriting: 0, voice: 0, video: 0 };
    const genreCounts = {};

    Object.entries(entriesByDate).forEach(([key, dayData]) => {
      const [y, m] = key.split("-").map(Number);
      if (y !== year || m !== month) return;

      (dayData.records || []).forEach((record) => {
        ["diary", "handwriting", "voice", "video"].forEach((field) => {
          if (record[field]) typeCounts[field] += 1;
        });
      });

      const musicList = Array.isArray(dayData.music)
        ? dayData.music
        : dayData.music
        ? [dayData.music]
        : [];

      musicList.forEach((music) => {
        (music.genres || []).forEach((genre) => {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
      });
    });

    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return { typeCounts, topGenres };
  }, [entriesByDate, calendarDate]);

  // 트랙 커버 썸네일용 색상 생성 (장르/라벨 기반 고정 색상)
  const thumbPalette = ["#c084fc", "#60a5fa", "#4ade80", "#fbbf24", "#f472b6", "#38bdf8", "#fb923c", "#a78bfa"];
  const getThumbColor = (seed) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    return thumbPalette[Math.abs(hash) % thumbPalette.length];
  };

  const handleGenerateLyricsClick = () => {
    if (selectedCount === 0) return;
    const sourceItems = Object.values(selectedItems);
    onGenerateLyrics(sourceItems);
    setSelectedItems({});
  };

  // 목록 아이템 스타일
  const listItemWrapperStyle = {
    position: "relative",
    listStyle: "none",
  };

  const trashBtnStyle = {
    position: "absolute",
    top: "10px",
    right: "10px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "15px",
    opacity: 0,
    transition: "opacity .2s",
    color: "rgba(255,255,255,.7)",
    padding: "4px",
  };

  const checkboxWrapperStyle = {
    position: "absolute",
    top: "10px",
    left: "10px",
  };

  const itemColors = {
    diary: { bg: "rgba(96,165,250,.15)", border: "rgba(96,165,250,.3)" },
    handwriting: { bg: "rgba(74,222,128,.15)", border: "rgba(74,222,128,.3)" },
    voice: { bg: "rgba(192,132,252,.15)", border: "rgba(192,132,252,.3)" },
    video: { bg: "rgba(251,146,60,.15)", border: "rgba(251,146,60,.3)" },
    music: { bg: "rgba(13, 5, 49, 0.3)", border: "rgba(13, 5, 49, 0.3)" },
  };

  if (!visible) return null;

  return (
    <div
      className="calendar-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        overflowY: "auto",
        animation: "screenFadeIn 0.35s ease-out",
      }}
    >
      <div
  style={{
    width: "100%",
    maxWidth: "1200px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
    alignItems: "stretch",
    backgroundColor: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px",
    padding: "28px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  }}
>
        {/* 달력 */}
        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(10px)",
            border: "0px solid rgba(255,255,255,0)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 8px 32px 0 rgba(31,38,135,0.17)",
            height: "fit-content",
          }}
        >
          {/* 월 헤더 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <button
              onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}
              style={{ background: "none", border: "none", color: "white", fontSize: "18px", cursor: "pointer", padding: "8px" }}
            >
              ◀
            </button>

            <h3 style={{ color: "white", fontSize: "18px", fontWeight: "600", margin: 0 }}>
              {calendarDate.getFullYear()}년 {calendarDate.getMonth() + 1}월
            </h3>

            <button
              onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}
              style={{ background: "none", border: "none", color: "white", fontSize: "18px", cursor: "pointer", padding: "8px" }}
            >
              ▶
            </button>
          </div>

          {/* 요일 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "8px", marginBottom: "8px" }}>
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
              <div key={day} style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "15px", fontWeight: "600", padding: "6px" }}>
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 영역 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "clamp(2px, 0.8vw, 8px)", width: "100%" }}>
            {days.map((day, index) => {
              const dayKey = day ? `${calendarDate.getFullYear()}-${calendarDate.getMonth()}-${day}` : null;
              const dayData = dayKey ? entriesByDate[dayKey] : null;
              const dayRecords = dayData?.records || [];
              const typesSet = new Set();
              dayRecords.forEach((r) => {
                ["diary", "handwriting", "voice", "video"].forEach((f) => {
                  if (r[f]) typesSet.add(f);
                });
              });
              const dayMusicList = Array.isArray(dayData?.music)
                ? dayData.music
                : dayData?.music
                ? [dayData.music]
                : [];
              if (dayMusicList.length > 0) typesSet.add("music");
              const dayTypes = Array.from(typesSet);

              const isSelected =
                selectedDate &&
                day &&
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === calendarDate.getMonth() &&
                selectedDate.getFullYear() === calendarDate.getFullYear();

              return (
                <button
                  key={index}
                  disabled={!day}
                  className={day ? "calendar-day-btn" : ""}
                  onClick={() => {
                    if (day) {
                      onSelectDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day));
                    }
                  }}
                  style={{
  padding: "clamp(4px, 1vw, 6px)",
  minWidth: 0,
  aspectRatio: "1 / 1",
  borderRadius: "8px",
  border: isSelected
    ? "0px solid rgba(108,99,255,.7)"
    : "0px solid rgba(255,255,255,.1)",
  outline: "none",
  backgroundColor: isSelected ? "rgba(108,99,255,.5)" : "rgba(255, 255, 255, 0.05)",
  backdropFilter: "blur(10px)",
  color: day ? "white" : "rgba(255,255,255,.2)",
  minHeight: "6px",
  fontSize: "13px",
  fontWeight: "600",
  cursor: day ? "pointer" : "default",
  transition: "all .3s ease",
}}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                    <span>{day}</span>
                    {dayTypes.length > 0 && (
                      <div style={{ display: "flex", gap: "2px" }}>
                        {dayTypes.map((type) => (
                          <span
                            key={type}
                            style={{
                              width: "5px",
                              height: "5px",
                              borderRadius: "50%",
                              backgroundColor: typeColors[type] || "rgba(255,255,255,.6)",
                              display: "inline-block",
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 범례 */}
          <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center" }}>
            {[
              { type: "diary", label: "일기" },
              { type: "handwriting", label: "사진" },
              { type: "voice", label: "음성" },
              { type: "video", label: "영상" },
              { type: "music", label: "음악" },
            ].map(({ type, label }) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: typeColors[type],
                    display: "inline-block",
                  }}
                />
                <span style={{ color: "rgba(255,255,255,.6)", fontSize: "12px" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* 이번 달 통계 */}
          <div
            style={{
              marginTop: "18px",
              paddingTop: "16px",
              borderTop: "1px solid rgba(255,255,255,.15)",
            }}
          >
            <h4 style={{ color: "white", fontSize: "14px", fontWeight: "700", margin: "0 0 10px 0" }}>
              이번 달 TOP 3 장르
            </h4>
            {monthStats.topGenres.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,.45)", fontSize: "12px", margin: "0 0 16px 0" }}>
                아직 생성된 음악이 없어요.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                {monthStats.topGenres.map(([genre, count], i) => (
                  <div
                    key={genre}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "rgba(255,255,255,.06)",
                      border: "1px solid rgba(255,255,255,0)",
                      borderRadius: "8px",
                      padding: "6px 10px",
                    }}
                  >
                    <span style={{ color: "white", fontSize: "12px", fontWeight: "600" }}>
                      {["🥇", "🥈", "🥉"][i]} {genre}
                    </span>
                    <span style={{ color: "rgba(255,255,255,.55)", fontSize: "11px" }}>{count}회</span>
                  </div>
                ))}
              </div>
            )}

            <h4 style={{ color: "white", fontSize: "14px", fontWeight: "700", margin: "0 0 10px 0" }}>
              파트별 기록 횟수
            </h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {[
                { type: "diary", label: "일기" },
                { type: "handwriting", label: "사진" },
                { type: "voice", label: "음성" },
                { type: "video", label: "영상" },
              ].map(({ type, label }) => (
                <div
                  key={type}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "rgba(255,255,255,.06)",
                    border: "1px solid rgba(255,255,255,0)",
                    borderRadius: "999px",
                    padding: "6px 12px",
                  }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      backgroundColor: typeColors[type],
                      display: "inline-block",
                    }}
                  />
                  <span style={{ color: "white", fontSize: "12px" }}>
                    {label} {monthStats.typeCounts[type]}회
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 오른쪽 영역 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", minHeight: 0 }}>
          {/* 일기 기록하기 버튼 */}
          <button
  onClick={onRecordClick}
  disabled={!selectedDate}
  style={{ ...menuBtnStyle, opacity: selectedDate ? 1 : 0.5, cursor: selectedDate ? "pointer" : "not-allowed" }}
  onMouseEnter={(e) => {
    if (selectedDate) e.target.style.backgroundColor = "rgba(255,255,255,.15)";
  }}
  onMouseLeave={(e) => {
    e.target.style.backgroundColor = "rgba(255,255,255,.08)";
  }}
>
  오늘의 일기 기록하기
</button>

          {/* 일기 목록보기 */}
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(10px)",
              border: "0px solid rgba(255,255,255,0)",
              borderRadius: "16px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              flex: "1 1 auto",
              minHeight: 0,
              maxHeight: "360px",
            }}
          >
            {/* 헤더 + 가사 생성 버튼 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "14px", flexShrink: 0, flexWrap: "wrap" }}>
              <h4 style={panelHeaderStyle}>오늘의 일기 목록보기</h4>
              <button
  onClick={handleGenerateLyricsClick}
  disabled={selectedCount === 0}
  style={{
    backgroundColor: selectedCount > 0 ? "rgba(244,114,182,.25)" : "rgba(255,255,255,.05)",
    border: "none",
    borderRadius: "10px",
    color: selectedCount > 0 ? "white" : "rgba(255,255,255,.35)",
    fontSize: "12px",
    fontWeight: "600",
    padding: "8px 12px",
    cursor: selectedCount > 0 ? "pointer" : "not-allowed",
    whiteSpace: "nowrap",
    transition: "all .3s ease",
  }}
  onMouseEnter={(e) => {
    if (selectedCount > 0) e.target.style.backgroundColor = "rgba(244,114,182,.4)";
  }}
  onMouseLeave={(e) => {
    e.target.style.backgroundColor = selectedCount > 0 ? "rgba(244,114,182,.25)" : "rgba(255,255,255,.05)";
  }}
>
  장르·악기·보컬·길이 선택하기{selectedCount > 0 ? ` (${selectedCount})` : ""}
</button>
            </div>

            {!selectedDate ? (
              <p style={{ color: "rgba(255,255,255,.5)", fontSize: "14px", margin: 0, textAlign: "center" }}>
                왼쪽 캘린더에서 날짜를 선택해주세요.
              </p>
            ) : (
              <>
                <p style={{ color: "rgba(255,255,255,.7)", fontSize: "13px", fontWeight: "600", margin: "0 0 10px 0", flexShrink: 0 }}>
                  {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 기록 · 가사에 쓸 항목을 체크해보세요
                </p>

                {records.length === 0 && (
                  <p style={{ color: "rgba(255,255,255,.5)", fontSize: "13px", margin: 0 }}>
                    이 날짜에 저장된 기록이 없어요.
                  </p>
                )}

                <div
                  className="glass-scroll"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    overflowY: "auto",
                    paddingRight: "4px",
                    minHeight: 0,
                  }}
                >
                  {records.map((record) => (
                    <div key={record.id} style={{ display: "flex", flexDirection: "column", gap: "10px", listStyle: "none" }}>
                      {record.diary && (
                        <div
                          className="record-card"
                          style={{
                            ...listItemWrapperStyle,
                            backgroundColor: itemColors.diary.bg,
                            border: `0px solid ${itemColors.diary.border}`,
                            borderRadius: "12px",
                            padding: "12px",
                            cursor: "pointer",
                          }}
                          onClick={() => openPreview("diary", record.diary, record.id)}
                        >
                          <label style={checkboxWrapperStyle} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={!!selectedItems[`${record.id}-diary`]}
                              onChange={() => toggleSelectItem(`${record.id}-diary`, "diary", record.diary)}
                              style={{ width: "16px", height: "16px", cursor: "pointer" }}
                            />
                          </label>
                          <p style={{ color: "rgba(255,255,255,.6)", fontSize: "12px", margin: "0 0 6px 0", fontWeight: "600", paddingLeft: "24px" }}>일기</p>
                          <p style={{ color: "white", fontSize: "14px", margin: 0, paddingLeft: "24px", paddingRight: "20px" }}>{getFirstSentence(record.diary)}</p>
                          <button
                            className="record-card-trash"
                            style={trashBtnStyle}
                            onClick={(e) => { e.stopPropagation(); onDeleteField(selectedKey, record.id, "diary"); }}
                            title="삭제"
                          >
                            🗑
                          </button>
                        </div>
                      )}

                      {record.handwriting && (
                        <div
                          className="record-card"
                          style={{
                            ...listItemWrapperStyle,
                            backgroundColor: itemColors.handwriting.bg,
                            border: `0px solid ${itemColors.handwriting.border}`,
                            borderRadius: "12px",
                            padding: "12px",
                            cursor: "pointer",
                          }}
                          onClick={() => openPreview("handwriting", record.handwriting, record.id, null, null, null, record.handwritingMemo)}
                        >
                          <label style={checkboxWrapperStyle} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={!!selectedItems[`${record.id}-handwriting`]}
                              onChange={() => toggleSelectItem(`${record.id}-handwriting`, "handwriting", record.handwriting)}
                              style={{ width: "16px", height: "16px", cursor: "pointer" }}
                            />
                          </label>
                          <p style={{ color: "rgba(255,255,255,.6)", fontSize: "12px", margin: "0 0 4px 0", fontWeight: "600", paddingLeft: "24px" }}>사진</p>
                          <p style={{ color: "white", fontSize: "14px", margin: 0, paddingLeft: "24px", paddingRight: "20px" }}>사진이 저장되어 있어요 · 눌러서 보기</p>
                          <button
                            className="record-card-trash"
                            style={trashBtnStyle}
                            onClick={(e) => { e.stopPropagation(); onDeleteField(selectedKey, record.id, "handwriting"); }}
                            title="삭제"
                          >
                            🗑
                          </button>
                        </div>
                      )}

                      {record.voice && (
                        <div
                          className="record-card"
                          style={{
                            ...listItemWrapperStyle,
                            backgroundColor: itemColors.voice.bg,
                            border: `0px solid ${itemColors.voice.border}`,
                            borderRadius: "12px",
                            padding: "12px",
                            cursor: "pointer",
                          }}
                          onClick={() => openPreview("voice", record.voice, record.id, null, null, null, record.voiceMemo)}
                        >
                          <label style={checkboxWrapperStyle} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={!!selectedItems[`${record.id}-voice`]}
                              onChange={() => toggleSelectItem(`${record.id}-voice`, "voice", record.voice)}
                              style={{ width: "16px", height: "16px", cursor: "pointer" }}
                            />
                          </label>
                          <p style={{ color: "rgba(255,255,255,.6)", fontSize: "12px", margin: "0 0 4px 0", fontWeight: "600", paddingLeft: "24px" }}>음성</p>
                          <p style={{ color: "white", fontSize: "14px", margin: 0, paddingLeft: "24px", paddingRight: "20px" }}>음성이 저장되어 있어요 · 눌러서 듣기</p>
                          <button
                            className="record-card-trash"
                            style={trashBtnStyle}
                            onClick={(e) => { e.stopPropagation(); onDeleteField(selectedKey, record.id, "voice"); }}
                            title="삭제"
                          >
                            🗑
                          </button>
                        </div>
                      )}

                      {record.video && (
                        <div
                          className="record-card"
                          style={{
                            ...listItemWrapperStyle,
                            backgroundColor: itemColors.video.bg,
                            border: `0px solid ${itemColors.video.border}`,
                            borderRadius: "12px",
                            padding: "12px",
                            cursor: "pointer",
                          }}
                          onClick={() => openPreview("video", record.video, record.id, null, null, null, record.videoMemo)}
                        >
                          <label style={checkboxWrapperStyle} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={!!selectedItems[`${record.id}-video`]}
                              onChange={() => toggleSelectItem(`${record.id}-video`, "video", record.video)}
                              style={{ width: "16px", height: "16px", cursor: "pointer" }}
                            />
                          </label>
                          <p style={{ color: "rgba(255,255,255,.6)", fontSize: "12px", margin: "0 0 4px 0", fontWeight: "600", paddingLeft: "24px" }}>영상</p>
                          <p style={{ color: "white", fontSize: "14px", margin: 0, paddingLeft: "24px", paddingRight: "20px" }}>영상이 저장되어 있어요 · 눌러서 보기</p>
                          <button
                            className="record-card-trash"
                            style={trashBtnStyle}
                            onClick={(e) => { e.stopPropagation(); onDeleteField(selectedKey, record.id, "video"); }}
                            title="삭제"
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        {/* 음악 목록 */}
<div
  style={{
    backgroundColor: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(10px)",
    border: "0px solid rgba(255,255,255,0)",
    borderRadius: "16px",
    padding: "18px",
    flexShrink: 0,
    maxHeight: "320px",
    display: "flex",
    flexDirection: "column",
  }}
>
  <h4
    style={{
      ...panelHeaderStyle,
      textAlign: "center",
      marginBottom: "14px",
      flexShrink: 0,
    }}
  >
    저장된 오늘의 음악 목록
  </h4>

  <div
    className="glass-scroll"
    style={{
      overflowY: "auto",
      minHeight: 0,
      paddingRight: "4px",
    }}
  >
    {!selectedDate ? (
      <p style={{ color: "rgba(255,255,255,.5)", fontSize: "14px", margin: 0, textAlign: "center" }}>
        왼쪽 캘린더에서 날짜를 선택해주세요.
      </p>
    ) : musicList.length > 0 ? (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {musicList.map((music) => {
          const thumbColor = getThumbColor(music.label + (music.genres?.[0] || ""));
          return (
            <div
              key={music.id}
              className="record-card"
              style={{
                ...listItemWrapperStyle,
                backgroundColor: itemColors.music.bg,
                border: `0px solid ${itemColors.music.border}`,
                borderRadius: "12px",
                padding: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
              onClick={() => openPreview("music", music.url, null, music.lyrics, music.coverUrl, music.label)}
            >
              {music.coverUrl ? (
                <img
                  src={music.coverUrl}
                  alt=""
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    flexShrink: 0,
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    flexShrink: 0,
                    background: `linear-gradient(135deg, ${thumbColor}, ${thumbColor}88)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                  }}
                >
                  {music.type === "full" ? "💿" : "🎧"}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0, paddingRight: "20px" }}>
                <p style={{ color: "rgba(255,255,255,.6)", fontSize: "12px", margin: "0 0 4px 0", fontWeight: "600" }}>
                  {music.label || "생성된 음악"}
                </p>
                <p style={{ color: "white", fontSize: "14px", margin: 0 }}>눌러서 듣기</p>
              </div>
              <button
                className="record-card-trash"
                style={trashBtnStyle}
                onClick={(e) => { e.stopPropagation(); onDeleteMusic(selectedKey, music.id); }}
                title="삭제"
              >
                🗑
              </button>
            </div>
          );
        })}
      </div>
    ) : (
      <p style={{ color: "rgba(255,255,255,.5)", fontSize: "13px", margin: 0, textAlign: "center" }}>
        이 날짜에 저장된 음악이 없어요.
      </p>
    )}
  </div>
</div>

          {/* 돌아가기 */}
          <div style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
  <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "14px" }}>
    메인으로
  </button>
</div>
        </div>
      </div>

      {/* 미리보기 모달 */}
      {preview && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            backgroundColor: "rgba(0,0,0,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "700px",
              backgroundColor: "rgba(30,30,40,.9)",
              backdropFilter: "blur(14px)",
              border: "0px solid rgba(255,255,255,0)",
              borderRadius: "16px",
              padding: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              {preview.type === "diary" && !isEditingDiary && (
                <button
                  onClick={() => setIsEditingDiary(true)}
                  style={{
                    background: "rgba(108,99,255,.25)",
                    border: "0px solid rgba(108,99,255,0)",
                    borderRadius: "8px",
                    color: "white",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    padding: "6px 14px",
                  }}
                >
                  ✏️ 수정
                </button>
              )}
              {preview.type === "diary" && isEditingDiary && (
                <button
                  onClick={handleSaveDiaryEdit}
                  style={{
                    background: "rgba(76,175,80,.25)",
                    border: "0px solid rgba(76,175,80,0)",
                    borderRadius: "8px",
                    color: "white",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    padding: "6px 14px",
                  }}
                >
                  저장
                </button>
              )}
              {preview.type !== "diary" && <div />}

              <button
                onClick={closePreview}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,.8)", fontSize: "15px", fontWeight: "600", cursor: "pointer" }}
              >
                뒤로가기 ✕
              </button>
            </div>

            {preview.type === "diary" && (
              isEditingDiary ? (
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  style={{
                    width: "100%",
                    height: "260px",
                    padding: "16px",
                    borderRadius: "12px",
                    backgroundColor: "rgba(255,255,255,.1)",
                    border: "2px solid rgba(255,255,255,.25)",
                    color: "white",
                    fontSize: "15px",
                    resize: "none",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              ) : (
                <p style={{ color: "white", fontSize: "15px", lineHeight: "1.6", whiteSpace: "pre-wrap", margin: 0, padding: "8px" }}>
                  {preview.data}
                </p>
              )
            )}
            {preview.type === "handwriting" && (
                <>
    <img src={preview.data} alt="사진 미리보기" style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: "12px" }} />
    {preview.memo && (
      <div style={{ marginTop: "14px", padding: "12px 14px", borderRadius: "10px", backgroundColor: "rgba(255,255,255,.06)", border: "0px solid rgba(255,255,255,0)" }}>
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: "12px", fontWeight: "700", margin: "0 0 4px 0" }}>메모</p>
        <p style={{ color: "white", fontSize: "14px", margin: 0, whiteSpace: "pre-wrap" }}>{preview.memo}</p>
      </div>
    )}
  </>
)}
            {preview.type === "voice" && (
  <>
    <audio controls autoPlay src={preview.data} style={{ width: "100%" }} />
    {preview.memo && (
      <div style={{ marginTop: "14px", padding: "12px 14px", borderRadius: "10px", backgroundColor: "rgba(255,255,255,.06)", border: "0px solid rgba(255,255,255,0)" }}>
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: "12px", fontWeight: "700", margin: "0 0 4px 0" }}>메모</p>
        <p style={{ color: "white", fontSize: "14px", margin: 0, whiteSpace: "pre-wrap" }}>{preview.memo}</p>
      </div>
    )}
  </>
)}
            {preview.type === "video" && (
  <>
    <video controls autoPlay src={preview.data} style={{ width: "100%", maxHeight: "70vh", borderRadius: "12px" }} />
    {preview.memo && (
      <div style={{ marginTop: "14px", padding: "12px 14px", borderRadius: "10px", backgroundColor: "rgba(255,255,255,.06)", border: "0px solid rgba(255,255,255,0)" }}>
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: "12px", fontWeight: "700", margin: "0 0 4px 0" }}>메모</p>
        <p style={{ color: "white", fontSize: "14px", margin: 0, whiteSpace: "pre-wrap" }}>{preview.memo}</p>
      </div>
    )}
  </>
)}
            {preview.type === "music" && (
  <>
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "420px",
        borderRadius: "12px",
        overflow: "hidden",
        backgroundColor: "rgba(0,0,0,.3)",
      }}
    >
      {preview.coverUrl && (
        <img
          src={preview.coverUrl}
          alt="앨범 커버"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      {preview.label && (
        <p
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            color: previewTextColor,
            fontSize: "15px",
            fontWeight: "700",
            margin: 0,
            textShadow: previewTextShadow,
            WebkitTextStroke: previewTextStroke,
          }}
        >
          {preview.label}
        </p>
      )}

      {preview.lyrics && preview.lyrics.length > 0 && (
        <div
          className="glass-scroll"
          style={{
            position: "absolute",
            inset: 0,
            top: "50px",
            overflowY: "auto",
            textAlign: "center",
            padding: "6px 16px 16px",
          }}
        >
          {preview.lyrics.map((line, i) => (
            <p
              key={i}
              style={{
                color: previewTextColor,
                fontSize: "17px",
                fontWeight: "800",
                margin: "12px 0",
                textShadow: previewTextShadow,
                WebkitTextStroke: previewTextStroke,
              }}
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </div>

    <audio controls autoPlay src={preview.data} style={{ width: "100%", marginTop: "14px" }} />
  </>
)}
          </div>
        </div>
      )}
    </div>
  );
}
