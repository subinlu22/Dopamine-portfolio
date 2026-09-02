"use client";

import { useState, useEffect } from "react";

const genres = [
  "K-POP",
  "발라드",
  "트로트",
  "밴드",
  "힙합",
  "R&B",
  "소울",
  "인디",
  "얼터너티브",
  "록",
  "재즈",
  "클래식",
  "댄스",
  "팝",
  "신스팝",
  "포크",
  "뉴웨이브",
  "EDM",
  "펑크",
  "앰비언트",
  "트립합",
  "국악",
  "월드뮤직",
  "레게",
  "블루스",
  "메탈",
  "컨트리",
  "라틴",
  "하우스",
  "테크노",
  "판소리",
  "뮤지컬",
  "사운드트랙",
  "일렉트로닉",
];

const instruments = [
  "피아노",
  "어쿠스틱기타",
  "일렉트릭기타",
  "베이스",
  "드럼",
  "신스",
  "바이올린",
  "첼로",
  "플루트",
  "클라리넷",
  "색소폰",
  "트럼펫",
  "가야금",
  "거문고",
  "대금",
  "피리",
  "해금",
  "장고",
  "북",
  "오르간",
  "하프",
  "우쿨렐레",
  "만돌린",
  "호른",
];

const emotions = [
  "밝음",
  "행복",
  "우울",
  "슬픔",
  "차분",
  "고요함",
  "신남",
  "활기",
  "로맨틱",
  "사랑스러움",
  "신비",
  "몽환",
  "에너지",
  "잔잔함",
  "평온",
  "그리움",
  "희망",
  "긍정",
  "애잔함",
  "명상",
  "설렘",
  "고민",
  "충만함",
];

// 보컬/버전 옵션 (다섯 가지 확정): 솔로 2종 + 그룹 2종 + 듀엣 1종
// K-POP 장르 + 밝음/신남 등 감정 조합으로 "아이돌스러운" 느낌은 별도 태그 없이 표현 가능
// 그룹/듀엣은 서버에서 파트 구분(괄호 화음 표시)을 위한 가사 재포맷 대상 (GROUP_VERSION_NAMES와 이름 반드시 일치해야 함)
const versions = [
  "남자 솔로",
  "여자 솔로",
  "남녀 듀엣",
  "남자 그룹",
  "여자 그룹",
];

export default function MusicGenerator({
  visible,
  onBack,
  onCreateMusic,
}) {
const [selectedGenres, setSelectedGenres] = useState([]);
const [selectedInstruments, setSelectedInstruments] = useState([]);
const [selectedEmotions, setSelectedEmotions] = useState([]);
const [selectedVersions, setSelectedVersions] = useState([]);
const [selectedDuration, setSelectedDuration] = useState(90);
const [referenceFile, setReferenceFile] = useState(null);
const [durationInput, setDurationInput] = useState("1:30");
useEffect(() => {
  setDurationInput(formatDuration(selectedDuration));
}, []);

  const toggleSelection = (item, array, setArray) => {
    if (array.includes(item)) {
      setArray(array.filter((i) => i !== item));
    } else {
      setArray([...array, item]);
    }
  };

  const formatDuration = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

  const handleCreateMusic = () => {

    if (selectedGenres.length === 0 || selectedInstruments.length === 0 || selectedEmotions.length === 0 || selectedVersions.length === 0 || selectedDuration === "") {
      alert("장르, 악기, 감정, 버전, 노래 길이를 모두 선택해주세요!");
      return;
    }

    const musicOptions = {
  genres: selectedGenres,
  instruments: selectedInstruments,
  emotions: selectedEmotions,
  versions: selectedVersions,
  duration: selectedDuration,
  referenceFile: referenceFile,
};

    onCreateMusic(musicOptions);
  };

  const buttonStyle = {
    padding: "10px 14px",
    borderRadius: "10px",
    backgroundColor: "rgba(255,255,255,0.1)",
    border: "0px solid rgba(255,255,255,0)",
    backdropFilter: "blur(10px)",
    color: "white",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minHeight: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const selectedButtonStyle = (isSelected) => ({
    ...buttonStyle,
    backgroundColor: isSelected ? "rgba(108, 99, 255, 0.4)" : "rgba(255,255,255,0.1)",
    border: isSelected ? "0px solid rgba(108, 99, 255, 0.7)" : "0px solid rgba(255,255,255,0.05)",
  });

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "24px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1000px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* 제목 */}
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
            border: "2px solid rgba(255,255,255,0)",
            borderRadius: "16px",
            padding: "16px 24px",
            boxShadow: "0 8px 32px rgba(31,38,135,0.17)",
          }}
        >
          <h2
            style={{
              color: "white",
              fontSize: "28px",
              fontWeight: "700",
              textAlign: "center",
              margin: 0,
            }}
          >
            나만의 음악 만들기
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: "14px",
              textAlign: "center",
              margin: "8px 0 0 0",
            }}
          >
            장르, 악기, 감정, 버전, 노래 길이를 모두 선택해주세요
          </p>
        </div>
        
          {/* 레퍼런스 음악 */}
<div
  style={{
    backgroundColor: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
    border: "2px solid rgba(255,255,255,0)",
    borderRadius: "16px",
    padding: "20px",
  }}
>
  <h3
    style={{
      color: "white",
      marginBottom: "16px",
    }}
  >
    레퍼런스 음악 (선택)
  </h3>

  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "14px",
      flexWrap: "wrap",
    }}
  >
    <label
      htmlFor="reference-file-input"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 24px",
        borderRadius: "16px",
        border: "0px solid rgba(255,255,255,0.25)",
        background: "rgba(255,255,255,.05)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        color: "rgba(255,255,255,0.95)",
        fontSize: "13px",
        fontWeight: "700",
        letterSpacing: "0.05em",
        cursor: "pointer",
        transition: "all .25s ease",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.border = "0px solid rgba(255,255,255,.5)";
        e.currentTarget.style.background = "rgba(255,255,255,.12)";
        e.currentTarget.style.backdropFilter = "blur(14px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.border = "0px solid rgba(255,255,255,.25)";
        e.currentTarget.style.background = "rgba(255,255,255,.05)";
        e.currentTarget.style.backdropFilter = "blur(6px)";
      }}
    >
      파일 선택
    </label>

    <input
      id="reference-file-input"
      type="file"
      accept="audio/*"
      onChange={(e) => setReferenceFile(e.target.files[0])}
      style={{
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: 0,
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0,0,0,0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    />

    {referenceFile ? (
      <p
        style={{
          color: "rgba(255,255,255,.7)",
          margin: 0,
        }}
      >
        선택된 파일 : {referenceFile.name}
      </p>
    ) : (
      <p
        style={{
          color: "rgba(255,255,255,.4)",
          margin: 0,
        }}
      >
        선택된 파일 없음
      </p>
    )}
  </div>
</div>

        {/* 장르 선택 */}
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
            border: "0px solid rgba(255,255,255,0.25)",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              margin: "0 0 16px 0",
            }}
          >
            <h3
              style={{
                color: "white",
                fontSize: "18px",
                fontWeight: "600",
                margin: 0,
              }}
            >
              장르 선택 {selectedGenres.length > 0 && `(${selectedGenres.length})`}
            </h3>
            {selectedGenres.length > 0 && (
              <button
                onClick={() => setSelectedGenres([])}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,.6)",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                초기화
              </button>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))",
              gap: "12px",
            }}
          >
            {genres.map((genre) => (
              <button
                key={genre}
                onClick={() =>
                  toggleSelection(genre, selectedGenres, setSelectedGenres)
                }
                style={selectedButtonStyle(selectedGenres.includes(genre))}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "rgba(255,255,255,0.15)";
                  e.target.style.borderColor = "rgba(255,255,255,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = selectedGenres.includes(genre)
                    ? "rgba(108, 99, 255, 0.4)"
                    : "rgba(255,255,255,0.1)";
                  e.target.style.borderColor = selectedGenres.includes(genre)
                    ? "rgba(108, 99, 255, 0.7)"
                    : "rgba(255,255,255,0.2)";
                }}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* 악기 선택 */}
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
            border: "0px solid rgba(255,255,255,0.25)",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              margin: "0 0 16px 0",
            }}
          >
            <h3
              style={{
                color: "white",
                fontSize: "18px",
                fontWeight: "600",
                margin: 0,
              }}
            >
              악기 선택 {selectedInstruments.length > 0 && `(${selectedInstruments.length})`}
            </h3>
            {selectedInstruments.length > 0 && (
              <button
                onClick={() => setSelectedInstruments([])}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,.6)",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                초기화
              </button>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
              gap: "12px",
            }}
          >
            {instruments.map((instrument) => (
              <button
                key={instrument}
                onClick={() =>
                  toggleSelection(
                    instrument,
                    selectedInstruments,
                    setSelectedInstruments
                  )
                }
                style={selectedButtonStyle(selectedInstruments.includes(instrument))}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "rgba(255,255,255,0.15)";
                  e.target.style.borderColor = "rgba(255,255,255,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = selectedInstruments.includes(
                    instrument
                  )
                    ? "rgba(108, 99, 255, 0.4)"
                    : "rgba(255,255,255,0.1)";
                  e.target.style.borderColor = selectedInstruments.includes(
                    instrument
                  )
                    ? "rgba(108, 99, 255, 0.7)"
                    : "rgba(255,255,255,0.2)";
                }}
              >
                {instrument}
              </button>
            ))}
          </div>
        </div>

        {/* 감정 선택 */}
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
            border: "0px solid rgba(255,255,255,0.25)",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              margin: "0 0 16px 0",
            }}
          >
            <h3
              style={{
                color: "white",
                fontSize: "18px",
                fontWeight: "600",
                margin: 0,
              }}
            >
              감정 선택 {selectedEmotions.length > 0 && `(${selectedEmotions.length})`}
            </h3>
            {selectedEmotions.length > 0 && (
              <button
                onClick={() => setSelectedEmotions([])}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,.6)",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                초기화
              </button>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))",
              gap: "12px",
            }}
          >
            {emotions.map((emotion) => (
              <button
                key={emotion}
                onClick={() =>
                  toggleSelection(
                    emotion,
                    selectedEmotions,
                    setSelectedEmotions
                  )
                }
                style={selectedButtonStyle(selectedEmotions.includes(emotion))}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "rgba(255,255,255,0.15)";
                  e.target.style.borderColor = "rgba(255,255,255,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = selectedEmotions.includes(
                    emotion
                  )
                    ? "rgba(108, 99, 255, 0.4)"
                    : "rgba(255,255,255,0.1)";
                  e.target.style.borderColor = selectedEmotions.includes(emotion)
                    ? "rgba(108, 99, 255, 0.7)"
                    : "rgba(255,255,255,0.2)";
                }}
              >
                {emotion}
              </button>
            ))}
          </div>
        </div>

        {/* 버전 선택 (보컬 스타일) */}
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
            border: "0px solid rgba(255,255,255,0.25)",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              margin: "0 0 16px 0",
            }}
          >
            <h3
              style={{
                color: "white",
                fontSize: "18px",
                fontWeight: "600",
                margin: 0,
              }}
            >
              버전 선택 {selectedVersions.length > 0 && `(${selectedVersions.length})`}
            </h3>
            {selectedVersions.length > 0 && (
              <button
                onClick={() => setSelectedVersions([])}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,.6)",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                초기화
              </button>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
              gap: "12px",
            }}
          >
            {versions.map((version) => (
              <button
                key={version}
                onClick={() =>
                  toggleSelection(
                    version,
                    selectedVersions,
                    setSelectedVersions
                  )
                }
                style={selectedButtonStyle(selectedVersions.includes(version))}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "rgba(255,255,255,0.15)";
                  e.target.style.borderColor = "rgba(255,255,255,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = selectedVersions.includes(
                    version
                  )
                    ? "rgba(108, 99, 255, 0.4)"
                    : "rgba(255,255,255,0.1)";
                  e.target.style.borderColor = selectedVersions.includes(
                    version
                  )
                    ? "rgba(108, 99, 255, 0.7)"
                    : "rgba(255,255,255,0.2)";
                }}
              >
                {version}
              </button>
            ))}
          </div>
        </div>

      {/* 노래 길이 */}
<div
  style={{
    backgroundColor: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
    border: "0px solid rgba(255,255,255,0.25)",
    borderRadius: "16px",
    padding: "20px",
  }}
>
  <h3
  style={{
    color: "white",
    fontWeight: "700",
    marginBottom: "16px",
  }}
>
  노래 길이
</h3>

  <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "16px",
  }}
>
  <input
    type="range"
    min="0"
    max="210"
    value={selectedDuration}
    onChange={(e) => {
  const sec = Number(e.target.value);
  setSelectedDuration(sec);
  setDurationInput(formatDuration(sec));
}}
    style={{
      flex: 1,
      accentColor: "#8B5CF6",
      cursor: "pointer",
      height: "8px",
    }}
  />

  <input
  type="text"
  value={durationInput}
  onChange={(e) => {
    setDurationInput(e.target.value);
  }}
  onBlur={() => {
    const match = durationInput.match(/^(\d+):([0-5]?\d)$/);

    if (match) {
      let total =
        Number(match[1]) * 60 + Number(match[2]);

      if (total > 210) total = 210;
      if (total < 0) total = 0;

      setSelectedDuration(total);
      setDurationInput(formatDuration(total));
    } else {
      setDurationInput(formatDuration(selectedDuration));
    }
  }}
  style={{
    width: "95px",
    padding: "10px",
    borderRadius: "10px",
    border: "0px solid rgba(139,92,246,0.25)",
    background: "rgba(139,92,246,0.25)",
    color: "white",
    textAlign: "center",
    fontWeight: "700",
    fontSize: "15px",
    outline: "none",
  }}
/>
</div>
</div>

        {/* 버튼 */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          <button
            onClick={onBack}
            style={{
              flex: 1,
              height: "56px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(10px)",
              border: "0px solid rgba(255,255,255,0.25)",
              color: "white",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "rgba(255,255,255,0.15)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "rgba(255,255,255,0.08)";
            }}
          >
            취소
          </button>

          <button
            onClick={handleCreateMusic}
            style={{
              flex: 1,
              height: "56px",
              borderRadius: "12px",
              background: "rgba(76, 175, 80, 0.25)",
              backdropFilter: "blur(10px)",
              border: "0px solid rgba(76, 175, 80, 0.25)",
              color: "white",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "rgba(76, 175, 80, 0.4)";
              e.target.style.borderColor = "rgba(76, 175, 80, 0)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "rgba(76, 175, 80, 0.25)";
              e.target.style.borderColor = "rgba(76, 175, 80, 0)";
            }}
          >
            가사 생성하기
          </button>
        </div>
      </div>
    </div>
  );
}
