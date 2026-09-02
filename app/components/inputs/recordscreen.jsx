"use client";

import { useState, useRef, useEffect } from "react";
import fixWebmDuration from "fix-webm-duration";

// 브라우저가 실제로 지원하는 오디오 codec을 우선순위대로 찾아주는 함수
// (mimeType을 아예 안 정해주면 브라우저가 자동으로 고르다가 실패하는 경우가 있어서,
//  명시적으로 지정해줘야 안정적으로 동작함 - 학교 PC 크롬에서 mimeType이 빈 값으로
//  나오면서 재생 시 NotSupportedError 나던 버그의 원인)
function getSupportedAudioMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return ""; // 아무것도 지원 안 하면 빈 문자열 (브라우저 완전 기본값에 맡김)
}

export default function RecordScreen({
  visible,
  selectedDate,
  onBack,
  onSave,
  onGenerateLyrics,
}) {
  const [diaryText, setDiaryText] = useState("");
  const [handwritingImage, setHandwritingImage] = useState(null);
  const [voiceAudio, setVoiceAudio] = useState(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState(null); // 재생 전용 (Blob URL) - data URL 재생 불안정 문제 우회
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoData, setVideoData] = useState(null);
  const [photoMemo, setPhotoMemo] = useState("");
  const [voiceMemo, setVoiceMemo] = useState("");
  const [videoMemo, setVideoMemo] = useState("");

  const [photoCameraOn, setPhotoCameraOn] = useState(false);
  const photoVideoRef = useRef(null);
  const photoStreamRef = useRef(null);
  const photoCanvasRef = useRef(null);

  const voiceRecorderRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceTimerRef = useRef(null);
  const voiceStartTimeRef = useRef(0); // 녹음 시작 시각(ms) - duration 계산용

  const [videoCameraOn, setVideoCameraOn] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoRecTime, setVideoRecTime] = useState(0);
  const videoPreviewRef = useRef(null);
  const videoStreamRef = useRef(null);
  const videoRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const videoTimerRef = useRef(null);
  const videoStartTimeRef = useRef(0); // 녹화 시작 시각(ms) - duration 계산용

  useEffect(() => {
    if (visible) {
      setDiaryText("");
      setHandwritingImage(null);
      setVoiceAudio(null);
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
      setVoicePreviewUrl(null);
      setVideoData(null);
      setRecordingTime(0);
      setPhotoMemo("");
      setVoiceMemo("");
      setVideoMemo("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const startPhotoCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      photoStreamRef.current = stream;
      if (photoVideoRef.current) photoVideoRef.current.srcObject = stream;
      setPhotoCameraOn(true);
    } catch (err) {
      alert("카메라 접근 권한이 필요합니다.");
    }
  };

  const closePhotoCamera = () => {
    if (photoStreamRef.current) {
      photoStreamRef.current.getTracks().forEach((t) => t.stop());
      photoStreamRef.current = null;
    }
    setPhotoCameraOn(false);
  };

  const capturePhoto = () => {
    const video = photoVideoRef.current;
    const canvas = photoCanvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setHandwritingImage(canvas.toDataURL("image/png"));
    closePhotoCamera();
  };

  // 음성 녹음 시작
  // 참고: MediaRecorder가 만드는 webm 파일은 "재생시간(duration)" 정보가 컨테이너 안에
  // 제대로 안 담기는 크롬 브라우저의 알려진 버그가 있음 (재생바가 0:00으로 나오고 재생이 막힘).
  // fix-webm-duration 라이브러리로 녹음 종료 후 실제 걸린 시간을 파일에 다시 박아넣어서 해결.
  //
  // 추가로: mimeType을 지정 안 하고 new MediaRecorder(stream)만 쓰면, 학교 PC 크롬 환경에서
  // recorder.mimeType이 빈 값으로 나오고, 그 상태에서 Blob에 "audio/webm"이라고 하드코딩된
  // 라벨을 박아버리면 실제 인코딩 형식과 라벨이 안 맞아서 재생 시 NotSupportedError가 남.
  // -> getSupportedAudioMimeType()으로 명시적으로 codec을 지정하고,
  //    Blob 만들 때도 recorder.mimeType(실제 사용된 형식)을 그대로 써서 해결.
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];
      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const durationMs = Date.now() - voiceStartTimeRef.current;
        const actualMimeType = recorder.mimeType || "audio/webm";
        const rawBlob = new Blob(voiceChunksRef.current, { type: actualMimeType });

        // duration 정보를 파일에 정확히 박아넣은 뒤 data URL로 변환
        fixWebmDuration(rawBlob, durationMs, (fixedBlob) => {
          const reader = new FileReader();
          reader.onloadend = () => setVoiceAudio(reader.result);
          reader.readAsDataURL(fixedBlob);

          // 재생 미리듣기는 Blob URL로 (data URL 재생 시 duration/seek 깨지는 문제 우회)
          // 이전에 만든 미리듣기 URL이 있으면 메모리 누수 방지를 위해 해제
          if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
          setVoicePreviewUrl(URL.createObjectURL(fixedBlob));
        });

        stream.getTracks().forEach((t) => t.stop());
        clearInterval(voiceTimerRef.current);
      };
      recorder.start();
      voiceRecorderRef.current = recorder;
      voiceStartTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingTime(0);
      voiceTimerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
    } catch (err) {
      alert("마이크 권한이 필요합니다.");
    }
  };

  const stopVoiceRecording = () => {
    if (voiceRecorderRef.current) voiceRecorderRef.current.stop();
    setIsRecording(false);
  };

  const handleVoiceFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setVoiceAudio(event.target.result);
    reader.readAsDataURL(file);

    // 첨부한 파일도 재생 미리듣기는 Blob URL로 (녹음본과 동일한 방식으로 통일)
    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
    setVoicePreviewUrl(URL.createObjectURL(file));
  };

  const startVideoCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
      videoStreamRef.current = stream;
      setVideoCameraOn(true);
    } catch (err) {
      alert("카메라/마이크 접근 권한이 필요합니다.");
    }
  };

  // videoCameraOn이 true로 바뀌어서 <video> 태그가 실제로 화면에 그려진 "다음"에 실행됨.
  // startVideoCamera 안에서 바로 srcObject를 연결하면, 그 시점엔 아직 <video> 태그가
  // 조건부 렌더링 때문에 화면에 없어서(videoPreviewRef.current가 null) 연결이 씹혔음 -
  // 이 useEffect로 "그려진 다음에 연결"하도록 순서를 맞춤.
  useEffect(() => {
    if (videoCameraOn && videoPreviewRef.current && videoStreamRef.current) {
      videoPreviewRef.current.srcObject = videoStreamRef.current;
    }
  }, [videoCameraOn]);

  const closeVideoCamera = () => {
    if (videoRecorderRef.current && videoRecorderRef.current.state !== "inactive") {
      videoRecorderRef.current.stop();
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
    }
    clearInterval(videoTimerRef.current);
    setIsVideoRecording(false);
    setVideoCameraOn(false);
  };

  // 영상 녹화 시작 (음성과 동일하게 webm duration 버그 수정 적용)
  const startVideoRecording = () => {
    if (!videoStreamRef.current) return;
    videoChunksRef.current = [];
    const recorder = new MediaRecorder(videoStreamRef.current);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) videoChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const durationMs = Date.now() - videoStartTimeRef.current;
      const rawBlob = new Blob(videoChunksRef.current, { type: "video/webm" });

      fixWebmDuration(rawBlob, durationMs, (fixedBlob) => {
        const reader = new FileReader();
        reader.onloadend = () => setVideoData(reader.result);
        reader.readAsDataURL(fixedBlob);
      });

      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((t) => t.stop());
        videoStreamRef.current = null;
      }
      clearInterval(videoTimerRef.current);
      setVideoCameraOn(false);
      setIsVideoRecording(false);
    };
    recorder.start();
    videoRecorderRef.current = recorder;
    videoStartTimeRef.current = Date.now();
    setIsVideoRecording(true);
    setVideoRecTime(0);
    videoTimerRef.current = setInterval(() => setVideoRecTime((p) => p + 1), 1000);
  };

  const stopVideoRecording = () => {
    if (videoRecorderRef.current) videoRecorderRef.current.stop();
  };

  useEffect(() => {
    if (!visible) {
      closePhotoCamera();
      closeVideoCamera();
      if (isRecording) stopVoiceRecording();
    }
    return () => {
      closePhotoCamera();
      closeVideoCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const hasAnyEntry = !!(diaryText.trim() || handwritingImage || voiceAudio || videoData);

  const handleSaveClick = () => {
  if (!hasAnyEntry) {
    alert("일기, 사진, 음성, 영상 중 하나 이상 입력해주세요!");
    return;
  }
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    diary: diaryText.trim() || undefined,
    handwriting: handwritingImage || undefined,
    handwritingMemo: handwritingImage ? photoMemo.trim() || undefined : undefined, // ✅ 추가
    voice: voiceAudio || undefined,
    voiceMemo: voiceAudio ? voiceMemo.trim() || undefined : undefined, // ✅ 추가
    video: videoData || undefined,
    videoMemo: videoData ? videoMemo.trim() || undefined : undefined, // ✅ 추가
  };
  onSave(record);
};

  const handleGenerateLyricsClick = () => {
  const items = [];
  if (diaryText.trim()) items.push({ type: "diary", data: diaryText.trim() });
  if (handwritingImage) items.push({ type: "handwriting", data: handwritingImage, memo: photoMemo.trim() || undefined }); // ✅ 수정
  if (voiceAudio) items.push({ type: "voice", data: voiceAudio, memo: voiceMemo.trim() || undefined }); // ✅ 수정
  if (videoData) items.push({ type: "video", data: videoData, memo: videoMemo.trim() || undefined }); // ✅ 수정
  onGenerateLyrics(items);
};

  if (!visible) return null;

  const sectionStyle = {
    backgroundColor: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
    border: "0px solid rgba(255,255,255,0.2)",
    borderRadius: "16px",
    padding: "20px",
  };

  const titleStyle = {
    color: "white",
    fontSize: "18px",
    fontWeight: "600",
    margin: "0 0 16px 0",
  };

  const primaryBtn = {
    flex: 1,
    height: "52px",
    borderRadius: "12px",
    backgroundColor: "rgba(108,99,255,.25)",
    backdropFilter: "blur(10px)",
    border: "0px solid rgba(108,99,255,.5)",
    color: "white",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    width: "100%",
  };

  const dangerBtn = {
    flex: 1,
    height: "52px",
    borderRadius: "12px",
    backgroundColor: "rgba(255,80,80,.25)",
    backdropFilter: "blur(10px)",
    border: "0px solid rgba(255,80,80,.5)",
    color: "white",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    width: "100%",
  };

  const neutralBtn = {
    flex: 1,
    height: "52px",
    borderRadius: "12px",
    backgroundColor: "rgba(255,255,255,.08)",
    backdropFilter: "blur(10px)",
    border: "0px solid rgba(255,255,255,.25)",
    color: "white",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    width: "100%",
  };

  const resetLink = (active) => ({
    background: "none",
    border: "none",
    color: active ? "rgba(255,255,255,.65)" : "rgba(255,255,255,.25)",
    fontSize: "13px",
    cursor: active ? "pointer" : "default",
  });

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
      justifyContent: "center",
      padding: "24px",
      overflowY: "auto",
      animation: "screenFadeIn 0.35s ease-out",
    }}
  >
    {/* hover 효과 - CSS class 방식 (DOM 직접 조작 대신) */}
    <style jsx>{`
      .rs-hover-btn {
        transition: filter 0.15s ease, transform 0.15s ease;
      }
      .rs-hover-btn:hover:not(:disabled) {
        filter: brightness(1.2);
        transform: translateY(-1px);
      }
    `}</style>
      <div style={{ width: "100%", maxWidth: "900px", display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "40px" }}>
        {/* 제목 */}
        <div style={{ ...sectionStyle, padding: "16px 24px" }}>
          <h2 style={{ color: "white", fontSize: "26px", fontWeight: "700", textAlign: "center", margin: 0 }}>
            오늘의 일기 기록하기
          </h2>
          {selectedDate && (
            <p style={{ color: "rgba(255,255,255,.6)", fontSize: "14px", textAlign: "center", margin: "8px 0 0 0" }}>
              {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 · 새 기록 작성 중
            </p>
          )}
        </div>

        {/* 일기 섹션 */}
        <div style={sectionStyle}>
          <h3 style={titleStyle}>일기</h3>
          <textarea
            value={diaryText}
            onChange={(e) => setDiaryText(e.target.value)}
            placeholder="오늘의 일기를 입력하세요"
            className="placeholder:text-white/50"
            style={{
              width: "100%",
              height: "180px",
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "rgba(255,255,255,.1)",
              border: "0.1px solid rgba(255,255,255,.25)",
              color: "white",
              fontSize: "15px",
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* 사진 섹션 */}
        <div style={sectionStyle}>
          <h3 style={titleStyle}>사진</h3>
          <div
            style={{
              width: "100%",
              height: "260px",
              borderRadius: "12px",
              backgroundColor: "rgba(255,255,255,.06)",
              border: "0.1px dashed rgba(255,255,255,.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              marginBottom: "12px",
            }}
          >
            {photoCameraOn ? (
              <video ref={photoVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : handwritingImage ? (
              <img src={handwritingImage} alt="사진" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <p style={{ color: "rgba(255,255,255,.5)", fontSize: "14px" }}>사진을 선택해주세요.</p>
            )}
          </div>
          <canvas ref={photoCanvasRef} style={{ display: "none" }} />

          {photoCameraOn ? (
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={closePhotoCamera} style={neutralBtn}>닫기</button>
              <button onClick={capturePhoto} style={primaryBtn}>촬영</button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: "10px" }}>
                <label style={{ flex: 1, display: "flex" }}>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => setHandwritingImage(event.target.result);
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                  className="rs-hover-btn"
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.currentTarget.parentElement.querySelector("input").click(); }}
                    style={primaryBtn}
                  >
                    사진 선택
                  </button>
                </label>
                <div style={{ flex: 1 }}>
                  <button className="rs-hover-btn" type="button" onClick={startPhotoCamera} style={primaryBtn}>사진 찍기</button>
                </div>
              </div>
                          {/* ✅ 추가: 사진 메모 입력란 */}
  <textarea
    value={photoMemo}
    onChange={(e) => setPhotoMemo(e.target.value)}
    placeholder="이 사진에 대한 메모 (예: 친구들과 여행 갔을 때 찍은 노을 사진, 그날의 기분 등)"
    className="placeholder:text-white/50"
    style={{
      width: "100%",
      height: "70px",
      marginTop: "12px",
      padding: "12px 14px",
      borderRadius: "10px",
      backgroundColor: "rgba(255,255,255,.06)",
      border: "0.1px solid rgba(255,255,255,.2)",
      color: "white",
      fontSize: "13px",
      resize: "none",
      outline: "none",
      fontFamily: "inherit",
    }}
  />
              <div style={{ display: "flex", justifyContent: "center", marginTop: "10px" }}>
                <button onClick={() => {
                  setHandwritingImage(null);
                  setPhotoMemo("");
                }} disabled={!handwritingImage} style={resetLink(!!handwritingImage)}>초기화</button>
              </div>
            </>
          )}

        </div>

        {/* 음성 섹션 */}
        <div style={sectionStyle}>
          <h3 style={titleStyle}>음성</h3>
          <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
            <label style={{ flex: 1, display: "flex" }}>
              <input type="file" accept="audio/*" style={{ display: "none" }} onChange={handleVoiceFileUpload} />
              <button
  type="button"
  className="rs-hover-btn"
  onClick={(e) => { e.preventDefault(); e.currentTarget.parentElement.querySelector("input").click(); }}
  style={primaryBtn}
>
  녹음파일 첨부
</button>
            </label>
            <div style={{ flex: 1 }}>
              <button className="rs-hover-btn" onClick={isRecording ? stopVoiceRecording : startVoiceRecording} style={isRecording ? dangerBtn : primaryBtn}>
  {isRecording ? "녹음 종료" : "녹음 시작"}
</button>
            </div>
          </div>
          <div style={{ textAlign: "center", color: "white", fontSize: "20px", fontWeight: "700", marginBottom: "12px" }}>
            {String(Math.floor(recordingTime / 60)).padStart(2, "0")}:{String(recordingTime % 60).padStart(2, "0")}
          </div>
          {voicePreviewUrl && (
            <audio
              controls
              src={voicePreviewUrl}
              style={{ width: "100%", marginBottom: "12px" }}
              onError={(e) => {
                const audioEl = e.target;
                console.log("[재생 진단] audio 에러 코드:", audioEl.error?.code, "메시지:", audioEl.error?.message);
                console.log("[재생 진단] src:", audioEl.currentSrc);
              }}
              onLoadedMetadata={(e) => {
                console.log("[재생 진단] 메타데이터 로드 성공, duration:", e.target.duration);
              }}
            />
          )}
          {/* ✅ 추가: 음성 메모 입력란 */}
<textarea
  value={voiceMemo}
  onChange={(e) => setVoiceMemo(e.target.value)}
  placeholder="이 음성에 대한 메모 (예: 오늘 있었던 일을 이야기하며 느낀 감정 등)"
  className="placeholder:text-white/50"
  style={{
    width: "100%",
    height: "70px",
    marginTop: "12px",
    padding: "12px 14px",
    borderRadius: "10px",
    backgroundColor: "rgba(255,255,255,.06)",
    border: "0.1px solid rgba(255,255,255,.2)",
    color: "white",
    fontSize: "13px",
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
  }}
/>
          <div style={{ display: "flex", justifyContent: "center" }}>
  <button
    onClick={() => {
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
      setVoicePreviewUrl(null);
      setVoiceAudio(null);
      setRecordingTime(0);
      setVoiceMemo(""); // ✅ 추가: 초기화 시 메모도 함께 초기화
    }}
    disabled={!voiceAudio}
    style={resetLink(!!voiceAudio)}
  >
    초기화
  </button>
</div>

        </div>

        {/* 영상 섹션 */}
        <div style={sectionStyle}>
          <h3 style={titleStyle}>영상</h3>
          <div
            style={{
              width: "100%",
              height: "260px",
              borderRadius: "12px",
              backgroundColor: "rgba(255,255,255,.06)",
              border: "0.1px dashed rgba(255,255,255,.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              marginBottom: "12px",
              position: "relative",
            }}
          >
            {videoCameraOn ? (
              <>
                <video ref={videoPreviewRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {isVideoRecording && (
                  <div style={{ position: "absolute", top: "10px", left: "10px", backgroundColor: "rgba(255,80,80,.85)", color: "white", padding: "5px 10px", borderRadius: "8px", fontSize: "13px", fontWeight: "700" }}>
                    {String(Math.floor(videoRecTime / 60)).padStart(2, "0")}:{String(videoRecTime % 60).padStart(2, "0")}
                  </div>
                )}
              </>
            ) : videoData ? (
              <video controls src={videoData} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <p style={{ color: "rgba(255,255,255,.5)", fontSize: "14px" }}>영상을 선택해주세요.</p>
            )}
          </div>

          {videoCameraOn ? (
            <div style={{ display: "flex", gap: "10px" }}>
              {!isVideoRecording && (
                <button className="rs-hover-btn" onClick={closeVideoCamera} style={neutralBtn}>닫기</button>
              )}
              <button className="rs-hover-btn" onClick={isVideoRecording ? stopVideoRecording : startVideoRecording} style={isVideoRecording ? dangerBtn : primaryBtn}>
                {isVideoRecording ? "촬영 종료" : "촬영 시작"}
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <button className="rs-hover-btn" type="button" onClick={startVideoCamera} style={primaryBtn}>영상 찍기</button>
                </div>
                <label style={{ flex: 1, display: "flex" }}>
                  <input
                    type="file"
                    accept="video/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => setVideoData(event.target.result);
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    className="rs-hover-btn"
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.currentTarget.parentElement.querySelector("input").click(); }}
                    style={primaryBtn}
                  >
                    영상 첨부하기
                  </button>
                </label>
              </div>
                           {/* ✅ 추가: 영상 메모 입력란 */}
<textarea
  value={videoMemo}
  onChange={(e) => setVideoMemo(e.target.value)}
  placeholder="이 영상에 대한 메모 (예: 무엇을 하는 장면인지, 어떤 감정을 담고 싶은지 등)"
  className="placeholder:text-white/50"
  style={{
    width: "100%",
    height: "70px",
    marginTop: "12px",
    padding: "12px 14px",
    borderRadius: "10px",
    backgroundColor: "rgba(255,255,255,.06)",
    border: "0.1px solid rgba(255,255,255,.2)",
    color: "white",
    fontSize: "13px",
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
  }}
/>
              <div style={{ display: "flex", justifyContent: "center", marginTop: "10px" }}>
                <button onClick={() => {
                  setVideoData(null);
                  setVideoMemo("");
                }} disabled={!videoData} style={resetLink(!!videoData)}>초기화</button>
              </div>
 
            </>
          )}
        </div>

        {/* 하단 버튼 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
          {hasAnyEntry && (
            <button
              onClick={handleGenerateLyricsClick}
              className="rs-hover-btn"
              style={{
                width: "100%",
                height: "56px",
                borderRadius: "12px",
                backgroundColor: "rgba(244,114,182,.25)",
                backdropFilter: "blur(10px)",
                border: "0px solid rgba(244,114,182,.5)",
                color: "white",
                fontSize: "16px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              장르·악기·보컬·길이 선택하기
            </button>
          )}

          <button
            className="rs-hover-btn"
            onClick={handleSaveClick}
            style={{
              width: "100%",
              height: "56px",
              borderRadius: "12px",
              background: "rgba(108,99,255,.25)",
              backdropFilter: "blur(10px)",
              border: "0px solid rgba(108,99,255,.5)",
              color: "white",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            저장하기
          </button>

          <button
            className="rs-hover-btn"
            onClick={onBack}
            style={{
              width: "100%",
              height: "52px",
              borderRadius: "12px",
              background: "rgba(255,255,255,.08)",
              border: "0px solid rgba(255,255,255,.25)",
              color: "rgba(255,255,255,.8)",
              fontSize: "15px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
