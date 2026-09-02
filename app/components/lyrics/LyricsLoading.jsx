"use client";

export default function LyricsLoading({ visible, onCancel }) {
  if (!visible) return null;

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
        animation: "screenFadeIn 0.35s ease-out",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "500px",
          backgroundColor: "rgba(255,255,255,0.1)",
          backdropFilter: "blur(10px)",
          border: "2px solid rgba(255,255,255,0.2)",
          borderRadius: "16px",
          padding: "40px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            border: "5px solid rgba(255,255,255,.2)",
            borderTopColor: "rgba(108,99,255,.9)",
            borderRadius: "50%",
            margin: "0 auto 24px auto",
            animation: "spin 1s linear infinite",
          }}
        />
        <h2 style={{ color: "white", fontSize: "20px", fontWeight: "700", margin: "0 0 10px 0" }}>
          가사를 만들고 있어요
        </h2>
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: "14px", margin: "0 0 28px 0" }}>
          선택한 기록을 바탕으로 AI가 가사를 작성 중이에요
        </p>
        <button
          onClick={onCancel}
          style={{
            background: "rgba(255,255,255,.08)",
            border: "2px solid rgba(255,255,255,.25)",
            borderRadius: "12px",
            color: "white",
            fontSize: "15px",
            fontWeight: "600",
            padding: "12px 24px",
            cursor: "pointer",
          }}
        >
          취소
        </button>
      </div>
    </div>
  );
}
