// 백엔드 연동 전까지 쓸 더미 가사 생성기
// TODO: 나중에 실제 AI 가사 생성 API 응답으로 교체하면 됨
export function generateTrackLyrics(musicOptions) {
  const genre = musicOptions?.genres?.[0] || "오늘";
  const emotion = musicOptions?.emotions?.[0] || "이 하루";
  const instrument = musicOptions?.instruments?.[0] || "선율";

  return [
    `${emotion} 가득했던 오늘 하루`,
    `${genre} 리듬에 실어 보내`,
    `${instrument} 소리에 마음을 얹고`,
    "말하지 못했던 이야기들이",
    "이 노래 안에 스며들어",
    "조금은 가벼워지기를",
    "오늘의 너에게 닿기를",
  ];
}
