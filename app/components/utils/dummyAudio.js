// 실제 백엔드 연동 전까지 테스트용으로 재생 가능한 더미 음악(사인파 화음)을 생성합니다.
// 백엔드 API가 연결되면 이 함수 대신 실제 응답으로 받은 audio URL을 쓰면 됩니다.

function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export function generateDummyMusic(durationSec = 6) {
  return new Promise((resolve, reject) => {
    try {
      const sampleRate = 44100;
      const frameCount = sampleRate * durationSec;
      const ctx = new OfflineAudioContext(1, frameCount, sampleRate);

      const notes = [261.63, 329.63, 392.0]; // 도-미-솔 화음

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, 0);
        gain.gain.linearRampToValueAtTime(0.15, 0.3);
        gain.gain.linearRampToValueAtTime(0.15, durationSec - 0.5);
        gain.gain.linearRampToValueAtTime(0, durationSec);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(i * 0.15);
        osc.stop(durationSec);
      });

      ctx.startRendering().then((renderedBuffer) => {
        const blob = audioBufferToWavBlob(renderedBuffer);
        resolve(URL.createObjectURL(blob));
      });
    } catch (err) {
      reject(err);
    }
  });
}