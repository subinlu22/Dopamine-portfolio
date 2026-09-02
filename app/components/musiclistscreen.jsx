"use client";

import { useState } from "react";

export default function MusicListScreen({ visible, entriesByDate, onBack, onCreateMusicForDate }) {
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [preview, setPreview] = useState(false);

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
  const selectedEntry = selectedKey ? entriesByDate[selectedKey] || {} : {};

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
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
          alignItems: "start",
        }}
      >
        {/* 달력 */}
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
            border: "2px solid rgba(255,255,255,0.2)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 8px 32px 0 rgba(31,38,135,0.17)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))} style={{ background: "none", border: "none", color: "white", fontSize: "18px", cursor: "pointer", padding: "8px" }}>◀</button>
            <h3 style={{ color: "white", fontSize: "18px", fontWeight: "600", margin: 0 }}>{calendarDate.getFullYear()}년 {calendarDate.getMonth() + 1}월</h3>
            <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))} style={{ background: "none", border: "none", color: "white", fontSize: "18px", cursor: "pointer", padding: "8px" }}>▶</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "8px", marginBottom: "8px" }}>
            {["일","월","화","수","목","금","토"].map((day) => (
              <div key={day} style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "15px", fontWeight: "600", padding: "6px" }}>{day}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "clamp(2px, 0.8vw, 8px)", width: "100%" }}>
            {days.map((day, index) => {
              const dayKey = day ? `${calendarDate.getFullYear()}-${calendarDate.getMonth()}-${day}` : null;
              const dayEntry = dayKey ? entriesByDate[dayKey] : null;
              const dayTypes = dayEntry ? Object.keys(dayEntry).filter((k) => dayEntry[k]) : [];
              const isSelected = selectedDate && day &&
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === calendarDate.getMonth() &&
                selectedDate.getFullYear() === calendarDate.getFullYear();

              return (
                <button
                  key={index}
                  disabled={!day}
                  className={day ? "calendar-day-btn" : ""}
                  onClick={() => { if (day) setSelectedDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day)); }}
                  style={{
                    padding: "clamp(4px, 1vw, 6px)",
                    minWidth: 0,
                    aspectRatio: "1 / 1",
                    borderRadius: "8px",
                    border: "2px solid transparent",
                    outline: "none",
                    backgroundColor: isSelected ? "rgba(108,99,255,.5)" : "rgba(255,255,255,.08)",
                    backdropFilter: "blur(10px)",
                    color: day ? "white" : "rgba(255,255,255,.2)",
                    minHeight: "6px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: day ? "pointer" : "default",
                    transition: "all .3s ease",
                    borderColor: isSelected ? "rgba(108,99,255,.7)" : "rgba(255,255,255,.1)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                    <span>{day}</span>
                    {dayTypes.length > 0 && (
                      <div style={{ display: "flex", gap: "2px" }}>
                        {dayTypes.map((type) => (
                          <span key={type} style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: typeColors[type] || "rgba(255,255,255,.6)", display: "inline-block" }} />
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div style={{ marginTop: "20px", padding: "12px", backgroundColor: "rgba(108,99,255,.25)", borderRadius: "8px", textAlign: "center", color: "white", fontSize: "14px", fontWeight: "600" }}>
              선택 : {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일
            </div>
          )}
        </div>

        {/* 음악 목록 패널 */}
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
            border: "2px solid rgba(255,255,255,0.2)",
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            minHeight: "300px",
          }}
        >
          <h3 style={{ color: "white", fontSize: "18px", fontWeight: "700", margin: "0 0 4px 0" }}>
            🎵 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 음악
          </h3>

          {selectedEntry.music ? (
            <button
              onClick={() => setPreview(true)}
              style={{ backgroundColor: "rgba(244,114,182,.15)", border: "2px solid rgba(244,114,182,.3)", borderRadius: "12px", padding: "14px", textAlign: "left", cursor: "pointer" }}
            >
              <p style={{ color: "rgba(255,255,255,.6)", fontSize: "12px", margin: "0 0 4px 0", fontWeight: "600" }}>🎵 생성된 음악</p>
              <p style={{ color: "white", fontSize: "14px", margin: 0 }}>음악이 저장되어 있어요 · 눌러서 듣기</p>
            </button>
          ) : (
            <p style={{ color: "rgba(255,255,255,.5)", fontSize: "14px" }}>이 날짜에 저장된 음악이 없어요.</p>
          )}

          <button
            onClick={() => onCreateMusicForDate(selectedDate)}
            style={{
              width: "100%",
              height: "52px",
              borderRadius: "12px",
              backgroundColor: "rgba(76,175,80,.25)",
              border: "2px solid rgba(76,175,80,.5)",
              backdropFilter: "blur(10px)",
              color: "white",
              fontSize: "15px",
              fontWeight: "600",
              cursor: "pointer",
              marginTop: "6px",
            }}
          >
            🎵 새 음악 만들기
          </button>

          <div style={{ marginTop: "auto", paddingTop: "10px" }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "14px" }}>
              돌아가기
            </button>
          </div>
        </div>
      </div>

      {preview && selectedEntry.music && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
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
              maxWidth: "600px",
              backgroundColor: "rgba(30,30,40,.9)",
              backdropFilter: "blur(14px)",
              border: "2px solid rgba(255,255,255,.2)",
              borderRadius: "16px",
              padding: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
              <button onClick={() => setPreview(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.8)", fontSize: "15px", fontWeight: "600", cursor: "pointer" }}>
                뒤로가기 ✕
              </button>
            </div>
            <audio controls autoPlay src={selectedEntry.music} style={{ width: "100%" }} />
          </div>
        </div>
      )}
    </div>
  );
}
