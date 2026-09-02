"use client";

export default function LyricsError({ visible, errorMessage, onRetry, onBack }) {
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
          border: "2px solid rgba(255,80,80,0.3)",
          borderRadius: "16px",
          padding: "40px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
        <h2 style={{ color: "white", fontSize: "20px", fontWeight: "700", margin: "0 0 10px 0" }}>
          가사 생성에 실패했어요
        </h2>
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: "14px", margin: "0 0 28px 0" }}>
          {errorMessage || "잠시 후 다시 시도해주세요."}
        </p>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={onBack}
            style={{
              flex: 1,
              height: "52px",
              borderRadius: "12px",
              background: "rgba(255,255,255,.08)",
              border: "2px solid rgba(255,255,255,.25)",
              color: "white",
              fontSize: "15px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            돌아가기
          </button>
          <button
            onClick={onRetry}
            style={{
              flex: 1,
              height: "52px",
              borderRadius: "12px",
              background: "rgba(108,99,255,.25)",
              border: "2px solid rgba(108,99,255,.5)",
              color: "white",
              fontSize: "15px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </div>
    </div>
  );
}
