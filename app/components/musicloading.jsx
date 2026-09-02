"use client";

import { useState, useEffect } from "react";

const stages = [
  "감정을 분석하고 있어요...",
  "멜로디를 작곡하고 있어요...",
  "악기를 편곡하고 있어요...",
  "마무리하고 있어요...",
];

export default function MusicLoading({ visible, onCancel }) {
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStageIndex(0);
      setProgress(0);
      return;
    }

    const stageInterval = setInterval(() => {
      setStageIndex((prev) => (prev < stages.length - 1 ? prev + 1 : prev));
    }, 1500);

    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev < 92 ? prev + Math.random() * 6 : prev));
    }, 300);

    return () => {
      clearInterval(stageInterval);
      clearInterval(progressInterval);
    };
  }, [visible]);

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
          maxWidth: "480px",
          backgroundColor: "rgba(255,255,255,0.1)",
          backdropFilter: "blur(10px)",
          border: "2px solid rgba(255,255,255,0.2)",
          borderRadius: "20px",
          padding: "40px 32px",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(31,38,135,0.17)",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            margin: "0 auto 24px auto",
            borderRadius: "50%",
            border: "4px solid rgba(108,99,255,0.2)",
            borderTopColor: "rgba(108,99,255,0.9)",
            animation: "spin 1s linear infinite",
          }}
        />

        <h2
          style={{
            color: "white",
            fontSize: "22px",
            fontWeight: "700",
            margin: "0 0 12px 0",
          }}
        >
          음악 제작 중
        </h2>

        <p
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: "15px",
            margin: "0 0 28px 0",
            minHeight: "20px",
          }}
        >
          {stages[stageIndex]}
        </p>

        <div
          style={{
            width: "100%",
            height: "8px",
            borderRadius: "999px",
            backgroundColor: "rgba(255,255,255,0.15)",
            overflow: "hidden",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              width: `${Math.min(progress, 100)}%`,
              height: "100%",
              borderRadius: "999px",
              backgroundColor: "rgba(108,99,255,0.9)",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,.55)",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            취소
          </button>
        )}
      </div>
    </div>
  );
}