import wave
import struct
import math
import os

sample_rate = 44100
duration = 2.2  # secondes totales
total_samples = int(sample_rate * duration)

# Notes du carillon TCF officiel : Marimba/Glockenspiel mélodique
# Note 1: Sol 5 (783.99 Hz) à 0.0s
# Note 2: Si 5 (987.77 Hz) à 0.32s
# Note 3: Ré# 6 (1244.5 Hz) à 0.65s
notes = [
    {"start": 0.05, "freq": 783.99, "dur": 1.2, "amp": 0.55},
    {"start": 0.35, "freq": 987.77, "dur": 1.2, "amp": 0.65},
    {"start": 0.68, "freq": 1244.51, "dur": 1.4, "amp": 0.75},
]

samples = [0.0] * total_samples

for note in notes:
    start_sample = int(note["start"] * sample_rate)
    note_samples = int(note["dur"] * sample_rate)
    freq = note["freq"]
    amp = note["amp"]
    
    for i in range(note_samples):
        idx = start_sample + i
        if idx >= total_samples:
            break
        t = i / sample_rate
        
        # Enveloppe ADSR instrument à percussion (attaque percussive 5ms, extinction exponentielle)
        attack = min(1.0, t / 0.006)
        decay = math.exp(-3.2 * t)
        env = attack * decay
        
        # Harmoniques pour timbre de marimba / vibraphone cristallin
        fundamental = math.sin(2.0 * math.pi * freq * t)
        harmonic2 = 0.35 * math.sin(2.0 * math.pi * freq * 2.0 * t) * math.exp(-4.5 * t)
        harmonic3 = 0.18 * math.sin(2.0 * math.pi * freq * 3.0 * t) * math.exp(-6.0 * t)
        harmonic4 = 0.08 * math.sin(2.0 * math.pi * freq * 4.0 * t) * math.exp(-8.0 * t)
        
        val = (fundamental + harmonic2 + harmonic3 + harmonic4) * env * amp
        samples[idx] += val

# Normalisation et saturation douce
max_val = max(max(abs(s) for s in samples), 0.001)
scale = 0.88 / max_val

output_path = r"c:\Users\HP\Desktop\EDUDESK-TCF\EDUDESK-TCF\public\media\audios\jingle_tcf.wav"
os.makedirs(os.path.dirname(output_path), exist_ok=True)

with wave.open(output_path, "w") as wav_file:
    wav_file.setnchannels(2)  # Stereo
    wav_file.setsampwidth(2)  # 16-bit
    wav_file.setframerate(sample_rate)
    
    frames = bytearray()
    for i, s in enumerate(samples):
        # Léger effet stéréo panoramique (gauche vers droite)
        pan = min(1.0, max(0.0, i / (sample_rate * 1.0)))
        left = s * scale * (1.1 - 0.3 * pan)
        right = s * scale * (0.8 + 0.3 * pan)
        
        left_int = max(-32767, min(32767, int(left * 32767)))
        right_int = max(-32767, min(32767, int(right * 32767)))
        
        frames.extend(struct.pack("<hh", left_int, right_int))
        
    wav_file.writeframes(frames)

print(f"Jingle generated at: {output_path}")
