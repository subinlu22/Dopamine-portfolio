"use client";

import { useState, useEffect } from "react";

export default function LyricsResult({
  visible,
  lyricsText,
  onSave,
  onCreateMusic,
  onBackToOptions,
  onBack,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(lyricsText || "");

  useEffect(() => {
    if (visible) {
      setEditText(lyricsText || "");
      setIsEditing(false);
    }
  }, [visible, lyricsText]);

  if (!visible) return null;

  const handleSave = () => {
    onSave(editText);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(lyricsText || "");
    setIsEditing(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 35,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        overflowY: "auto",
        animation: "screenFadeIn 0.35s ease-out",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* 제목 */}
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
            border: "0px solid rgba(255,255,255,0.2)",
            borderRadius: "16px",
            padding: "16px 24px",
          }}
        >
          <h2 style={{ color: "white", fontSize: "24px", fontWeight: "700", textAlign: "center", margin: 0 }}>
            오늘의 가사
          </h2>
        </div>

        {/* 가사 내용 */}
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
            border: "0px solid rgba(255,255,255,0.2)",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          {isEditing ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              style={{
                width: "100%",
                height: "320px",
                padding: "16px",
                borderRadius: "12px",
                backgroundColor: "rgba(255,255,255,.1)",
                border: "0px solid rgba(255,255,255,.25)",
                color: "white",
                fontSize: "15px",
                lineHeight: "1.7",
                resize: "none",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          ) : (
            <p
              className="glass-scroll"
              style={{
                color: "white",
                fontSize: "15px",
                lineHeight: "1.8",
                whiteSpace: "pre-wrap",
                margin: 0,
                maxHeight: "400px",
                overflowY: "auto",
              }}
            >
              {lyricsText}
            </p>
          )}
        </div>

        {/* 버튼 */}
<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
  {isEditing ? (
    <div style={{ display: "flex", gap: "12px" }}>
      <button
        onClick={handleCancelEdit}
        style={{
          flex: 1,
          height: "52px",
          borderRadius: "12px",
          background: "rgba(255,255,255,.08)",
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
        취소
      </button>
      <button
        onClick={handleSave}
        style={{
          flex: 1,
          height: "52px",
          borderRadius: "12px",
          background: "rgba(76,175,80,.25)",
          border: "none",
          color: "white",
          fontSize: "15px",
          fontWeight: "600",
          cursor: "pointer",
          transition: "all 0.3s ease",
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = "rgba(76,175,80,.4)";
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = "rgba(76,175,80,.25)";
        }}
      >
        저장
      </button>
    </div>
  ) : (
    <button
      onClick={() => setIsEditing(true)}
      style={{
        width: "100%",
        height: "52px",
        borderRadius: "12px",
        background: "rgba(108,99,255,.25)",
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
      가사 수정하기
    </button>
  )}

  {/* 이 가사로 음악 만들기 (단독, 큰 버튼) */}
  <button
    onClick={onCreateMusic}
    disabled={isEditing}
    style={{
      width: "100%",
      height: "56px",
      borderRadius: "12px",
      backgroundColor: isEditing ? "rgba(76,175,80,.1)" : "rgba(76,175,80,.25)",
      backdropFilter: "blur(10px)",
      border: "none",
      color: isEditing ? "rgba(255,255,255,.4)" : "white",
      fontSize: "16px",
      fontWeight: "600",
      cursor: isEditing ? "not-allowed" : "pointer",
      transition: "all 0.3s ease",
    }}
    onMouseEnter={(e) => {
      if (!isEditing) e.target.style.backgroundColor = "rgba(76,175,80,.4)";
    }}
    onMouseLeave={(e) => {
      e.target.style.backgroundColor = isEditing ? "rgba(76,175,80,.1)" : "rgba(76,175,80,.25)";
    }}
  >
    이 가사로 음악 만들기
  </button>

  {/* 이전 선택 / 캘린더로 돌아가기 (좌우 배치) */}
  <div style={{ display: "flex", gap: "12px" }}>
    <button
      onClick={onBackToOptions}
      disabled={isEditing}
      style={{
        flex: 1,
        height: "52px",
        borderRadius: "12px",
        background: "rgba(255,255,255,.08)",
        border: "none",
        color: isEditing ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.85)",
        fontSize: "15px",
        fontWeight: "600",
        cursor: isEditing ? "not-allowed" : "pointer",
        transition: "all 0.3s ease",
      }}
      onMouseEnter={(e) => {
        if (!isEditing) e.target.style.backgroundColor = "rgba(255,255,255,.15)";
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = "rgba(255,255,255,.08)";
      }}
    >
      장르·악기·보컬·길이 다시 선택
    </button>

    <button
      onClick={onBack}
      style={{
        flex: 1,
        height: "52px",
        borderRadius: "12px",
        background: "rgba(255,255,255,.08)",
        border: "none",
        color: "rgba(255,255,255,.8)",
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
      캘린더로 돌아가기
    </button>
  </div>
</div>
      </div>
    </div>
  );
}
