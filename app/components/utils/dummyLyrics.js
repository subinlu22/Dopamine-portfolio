// app/components/utils/dummyLyrics.js

// TODO: 친구가 실제 백엔드(AI 가사 생성 API) 연동할 때 이 함수를 fetch 호출로 교체하면 됨
// 지금은 테스트용 더미 가사를 생성함
export function generateDummyLyrics(sourceItems = []) {
  const diaryTexts = sourceItems
    .filter((item) => item.type === "diary" && item.data)
    .map((item) => item.data.trim())
    .join(" ");

  const hasPhoto = sourceItems.some((item) => item.type === "handwriting");
  const hasVoice = sourceItems.some((item) => item.type === "voice");
  const hasVideo = sourceItems.some((item) => item.type === "video");

  const opening = diaryTexts
    ? `"${diaryTexts.slice(0, 24)}${diaryTexts.length > 24 ? "..." : ""}" 그 마음을 담아서`
    : "오늘 하루의 조각들을 모아서";

  const lines = [
    "[Verse 1]",
    opening,
    hasPhoto ? "사진 속에 머문 그 순간이 노래가 되고" : "흐릿한 기억도 노래가 되고",
    hasVoice ? "목소리에 담긴 떨림까지 가사가 되어" : "마음속 떨림까지 가사가 되어",
    "",
    "[Chorus]",
    "오늘의 도파민, 잊지 못할 하루",
    hasVideo ? "영상처럼 선명하게 남아있는 이 순간" : "선명하게 남아있는 이 순간",
    "그대로 담아, 노래로 남길게",
    "",
    "[Verse 2]",
    "(이 부분은 실제 AI가 기록을 분석해서 채워줄 자리예요)",
    "",
    "[Outro]",
    "오늘도 수고했어, 내일도 잘 부탁해",
  ];

  return lines.join("\n");
}