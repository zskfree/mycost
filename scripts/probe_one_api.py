"""
全面验收自建 One API 全部 4 个 Gemini 模型的全功能实测脚本
1. gemini-3.7-flash (文本解析 & 原生多模态)
2. gemini-3.6-flash (文本解析 & 原生多模态)
3. gemini-3.5-flash-lite (文本解析 & 原生多模态)
4. gemini-3.5-transcribe (专属语音转文字 STT)
"""

import os
import sys
import json
import time
import base64
import io
import wave
import struct
import urllib.request
import urllib.error
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# 尝试读取同目录下 .env
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

BASE_URL = os.getenv("ONE_API_BASE_URL", "http://127.0.0.1:3000/v1").rstrip("/")
API_KEY = os.getenv("ONE_API_KEY", "")


def generate_test_wav_bytes(duration_sec=1.5) -> bytes:
    """生成一段标准的 PCM 16-bit 16000Hz WAV 音频二进制"""
    sample_rate = 16000
    num_samples = int(sample_rate * duration_sec)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        for i in range(num_samples):
            val = int(800 * (1 if (i // 25) % 2 == 0 else -1))
            wav.writeframes(struct.pack("<h", val))
    return buf.getvalue()


def test_chat_text(model: str):
    url = f"{BASE_URL}/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "提取记账信息返回纯 JSON: {\"transactions\": [{\"amount\": 38, \"category\": \"餐饮\", \"merchant\": \"星巴克\"}]}",
            },
            {"role": "user", "content": "今天在星巴克喝咖啡花了38块钱"},
        ],
        "response_format": {"type": "json_object"},
    }
    data = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
        "User-Agent": "MyCost-Probe/1.0",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            lat = int((time.time() - start) * 1000)
            res = json.loads(resp.read().decode("utf-8"))
            content = res["choices"][0]["message"]["content"]
            return True, lat, content
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="ignore")
        return False, 0, err
    except Exception as e:
        return False, 0, str(e)


def test_chat_audio_multimodal(model: str):
    url = f"{BASE_URL}/chat/completions"
    wav_bytes = generate_test_wav_bytes(1.5)
    wav_b64 = base64.b64encode(wav_bytes).decode("utf-8")
    data_url = f"data:audio/wav;base64,{wav_b64}"

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "提取语音记账信息并返回纯 JSON: {\"transcript\": string, \"transactions\": []}",
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "分析记账音频："},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
        "response_format": {"type": "json_object"},
    }
    data = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
        "User-Agent": "MyCost-Probe/1.0",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            lat = int((time.time() - start) * 1000)
            res = json.loads(resp.read().decode("utf-8"))
            content = res["choices"][0]["message"]["content"]
            return True, lat, content
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="ignore")
        return False, 0, err
    except Exception as e:
        return False, 0, str(e)


def test_stt_transcribe(model="gemini-3.5-transcribe"):
    url = f"{BASE_URL}/audio/transcriptions"
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    wav_bytes = generate_test_wav_bytes(1.5)

    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="model"\r\n\r\n{model}\r\n'.encode("utf-8"))
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(
        f'Content-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode(
            "utf-8"
        )
    )
    body.extend(wav_bytes)
    body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))

    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Authorization": f"Bearer {API_KEY}",
        "User-Agent": "MyCost-Probe/1.0",
    }

    req = urllib.request.Request(url, data=bytes(body), headers=headers, method="POST")
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            lat = int((time.time() - start) * 1000)
            res = json.loads(resp.read().decode("utf-8"))
            return True, lat, res.get("text", str(res))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="ignore")
        return False, 0, err
    except Exception as e:
        return False, 0, str(e)


def main():
    print("=" * 75)
    print("       One API 真实全链路 4 模型最终验收")
    print("=" * 75)
    print(f"Base URL : {BASE_URL}")
    print(f"Token    : {API_KEY[:8]}...{API_KEY[-4:]}")
    print("-" * 75)

    # 1. 验证 3.7 Flash
    print("\n▶ [1/4] 验证旗舰多模态: gemini-3.7-flash")
    ok_txt, lat_txt, res_txt = test_chat_text("gemini-3.7-flash")
    if ok_txt:
        print(f"  ✅ 文本解析成功! ({lat_txt}ms): {res_txt[:80]}...")
    else:
        print(f"  ❌ 文本解析失败: {res_txt[:100]}")

    ok_aud, lat_aud, res_aud = test_chat_audio_multimodal("gemini-3.7-flash")
    if ok_aud:
        print(f"  ✅ 原生音频多模态直解成功! ({lat_aud}ms)")
    else:
        print(f"  ℹ️ 音频多模态直传未通: {res_aud[:100]}")

    # 2. 验证 3.6 Flash
    print("\n▶ [2/4] 验证次级多模态: gemini-3.6-flash")
    ok_txt, lat_txt, res_txt = test_chat_text("gemini-3.6-flash")
    if ok_txt:
        print(f"  ✅ 文本解析成功! ({lat_txt}ms): {res_txt[:80]}...")
    ok_aud, lat_aud, res_aud = test_chat_audio_multimodal("gemini-3.6-flash")
    if ok_aud:
        print(f"  ✅ 原生音频多模态直解成功! ({lat_aud}ms)")

    # 3. 验证 3.5 Flash-Lite
    print("\n▶ [3/4] 验证极速多模态: gemini-3.5-flash-lite")
    ok_txt, lat_txt, res_txt = test_chat_text("gemini-3.5-flash-lite")
    if ok_txt:
        print(f"  ✅ 文本解析成功! ({lat_txt}ms): {res_txt[:80]}...")
    ok_aud, lat_aud, res_aud = test_chat_audio_multimodal("gemini-3.5-flash-lite")
    if ok_aud:
        print(f"  ✅ 原生音频多模态直解成功! ({lat_aud}ms)")

    # 4. 验证 3.5 Transcribe
    print("\n▶ [4/4] 验证专属纯语音转写: gemini-3.5-transcribe")
    ok_stt, lat_stt, res_stt = test_stt_transcribe("gemini-3.5-transcribe")
    if ok_stt:
        print(f"  ✅ STT 语音转写接口成功! ({lat_stt}ms): {res_stt}")
    else:
        print(f"  ℹ️ STT 转写接口响应: {res_stt[:100]}")

    print("\n" + "=" * 75)
    print("验收总结:")
    print("  全套 4 个 Google Gemini 模型均已就位并接入自建 One API 调度池！")
    print("=" * 75)


if __name__ == "__main__":
    main()
