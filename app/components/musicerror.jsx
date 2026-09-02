"use client";

export default function MusicError({ visible, errorMessage, onRetry, onBack }) {
  if (!visible) return null;

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
        animation: "screenFadeIn 0.35s ease-out",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          backgroundColor: "rgba(255,255,255,0.1)",
          backdropFilter: "blur(10px)",
          border: "2px solid rgba(255,80,80,0.35)",
          borderRadius: "20px",
          padding: "40px 32px",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(31,38,135,0.17)",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>😢</div>

        <h2
          style={{
            color: "white",
            fontSize: "20px",
            fontWeight: "700",
            margin: "0 0 10px 0",
          }}
        >
          음악 생성에 실패했어요
        </h2>

        <p
          style={{
            color: "rgba(255,255,255,0.65)",
            fontSize: "14px",
            margin: "0 0 28px 0",
            lineHeight: 1.5,
          }}
        >
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
              backdropFilter: "blur(10px)",
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
              backdropFilter: "blur(10px)",
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