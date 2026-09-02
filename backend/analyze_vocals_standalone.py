# -*- coding: utf-8 -*-
"""
analyze_vocals_standalone.py (v3 - 음량 지속시간 방식)
VAD(말소리 인식) 대신, "충분히 크고 길게 지속되는 소리"로 보컬 시작/끝을 찾음.
노래 창법(모음을 길게 끄는 것)은 VAD가 말로 인식 못하지만,
음량+지속시간 방식은 노래인지 말인지 상관없이 잘 잡음.

사용법: python analyze_vocals_standalone.py <입력mp3> <결과json>
성공 판정: 결과 json 파일이 실제로 생겼는지로 확인
"""
import sys, os, json, tempfile, shutil

def main():
    if len(sys.argv) < 3:
        print("사용법: python analyze_vocals_standalone.py <입력오디오> <결과json>")
        sys.exit(1)

    input_path, output_json = sys.argv[1], sys.argv[2]
    if not os.path.exists(input_path):
        print(f"입력 파일 없음: {input_path}")
        sys.exit(1)

    temp_dir = tempfile.mkdtemp(prefix="vocal_sep_")
    try:
        import demucs.separate
        demucs.separate.main(["--two-stems", "vocals", "-n", "htdemucs_ft", "-o", temp_dir, input_path])

        song_name = os.path.splitext(os.path.basename(input_path))[0]
        vocals_path = os.path.join(temp_dir, "htdemucs_ft", song_name, "vocals.wav")
        if not os.path.exists(vocals_path):
            print(f"보컬 분리 실패: {vocals_path} 없음")
            sys.exit(1)

        import torch, torchaudio
        wav, sr = torchaudio.load(vocals_path)
        duration_sec = wav.shape[1] / sr
        if wav.shape[0] > 1:
            wav = wav.mean(dim=0, keepdim=True)
        mono = wav.squeeze(0)

        # --- 0.5초 단위 윈도우로 음량(RMS) 그래프 만들기 ---
        win = int(sr * 0.5)
        n_win = mono.shape[0] // win
        rms = torch.tensor([
            torch.sqrt(torch.mean(mono[i*win:(i+1)*win] ** 2)) for i in range(n_win)
        ])
        max_rms = rms.max().item()

        # --- "충분히 큼" 기준: 최대 음량의 40% 이상 ---
        loud = rms >= (max_rms * 0.40)

        # --- "3초(윈도우 6개) 이상 연속으로 충분히 큼" 구간만 진짜 보컬로 인정 ---
        MIN_RUN = 6  # 0.5초 * 6 = 3초
        loud_list = loud.tolist()
        runs = []  # (시작 윈도우, 끝 윈도우)
        i = 0
        while i < len(loud_list):
            if loud_list[i]:
                j = i
                while j < len(loud_list) and loud_list[j]:
                    j += 1
                if (j - i) >= MIN_RUN:
                    runs.append((i, j))
                i = j
            else:
                i += 1

        if not runs:
            result = {"success": False, "reason": "no_sustained_vocal_found", "duration_sec": round(duration_sec, 2)}
        else:
            vocal_start = runs[0][0] * 0.5
            vocal_end = runs[-1][1] * 0.5
            result = {
                "success": True,
                "vocal_start_sec": round(vocal_start, 2),
                "vocal_end_sec": round(vocal_end, 2),
                "duration_sec": round(duration_sec, 2),
                "run_count": len(runs),
            }

        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"분석 완료: {output_json}")

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    main()
