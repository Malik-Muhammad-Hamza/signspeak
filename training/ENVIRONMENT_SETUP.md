# SignSpeak v2 — Training Environment Setup

> **Python 3.11 (64-bit) is required.**  
> Do **not** use Python 3.12 or 3.14. MediaPipe 0.10.14 and TensorFlow 2.15.1 are only
> tested against 3.11. Newer Python versions may cause binary incompatibilities.

---

## 1. Install Python 3.11

Download the Windows 64-bit installer from the official Python website:

```
https://www.python.org/downloads/release/python-3119/
```

Filename to look for: `python-3.11.x-amd64.exe`

During installation, enable **all** of the following options:

- [x] Add Python 3.11 to PATH
- [x] pip
- [x] venv
- [x] py launcher (recommended — allows `py -3.11` to target the correct version)

---

## 2. Remove an Old / Broken venv (if one exists)

Open **PowerShell** and run:

```powershell
cd C:\Web-Dev\Project\signspeak

# If a venv is currently active, deactivate it first
deactivate

# Delete the broken venv
Remove-Item -Recurse -Force .\training\.venv
```

---

## 3. Create a Clean venv with Python 3.11

```powershell
py -3.11 -m venv .\training\.venv
```

This explicitly targets the Python 3.11 interpreter via the py launcher.

---

## 4. Activate the venv

```powershell
.\training\.venv\Scripts\Activate.ps1
```

If activation is blocked by PowerShell's execution policy:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\training\.venv\Scripts\Activate.ps1
```

You should see `(.venv)` at the start of your prompt when active.

---

## 5. Upgrade Core Tools

```powershell
python -m pip install --upgrade pip setuptools wheel
```

---

## 6. Install Pinned Dependencies

```powershell
python -m pip install -r training\requirements.txt
```

The following versions are pinned to ensure compatibility with the **legacy MediaPipe
Solutions API** (`mp.solutions.hands`) used in `01_extract_landmarks.py`:

| Package | Pinned Version | Why |
|---|---|---|
| `mediapipe` | 0.10.14 | Last version supporting `mp.solutions.hands` |
| `tensorflow` | 2.15.1 | Compatible with mediapipe 0.10.14 |
| `protobuf` | 4.25.3 | Fixes `ImportError: runtime_version` conflict |
| `opencv-python` | 4.10.0.84 | Stable headful build for local extraction |
| `numpy` | 1.26.4 | Required by TF 2.15 (numpy 2.x breaks it) |

---

## 7. Verify the Installation

Run these one-liners from the activated venv:

```powershell
python -c "import cv2; print('cv2 ok')"
python -c "import tensorflow as tf; print('tensorflow', tf.__version__)"
python -c "import mediapipe as mp; print('mediapipe', mp.__version__); print('solutions', hasattr(mp, 'solutions'))"
```

**Expected output:**

```
cv2 ok
tensorflow 2.15.1
mediapipe 0.10.14
solutions True
```

If all three lines print without errors, the environment is ready.

---

## 8. Run the Extraction Script

```powershell
cd C:\Web-Dev\Project\signspeak\training
python 01_extract_landmarks.py
```

---

## 9. TensorFlow.js Export — Do This Later (Separate venv)

> **Do not install `tensorflowjs` in the main training venv.**  
> It pulls in a different version of TensorFlow and will break the dependency set above.

After training completes and you are ready to export the model for browser use, create a
**separate** export venv:

```powershell
cd C:\Web-Dev\Project\signspeak

py -3.11 -m venv .\training\.venv-export
.\training\.venv-export\Scripts\Activate.ps1

python -m pip install --upgrade pip setuptools wheel
python -m pip install tensorflow==2.15.1 tensorflowjs
```

Then run the export script from within that venv:

```powershell
cd .\training
python 05_export_tfjs.py
```

**Do not do this now** — complete the full training pipeline first.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `ImportError: runtime_version` | `protobuf` version too new | Ensure `protobuf==4.25.3` is installed |
| `mp.solutions` missing / broken | `mediapipe` version too new | Ensure `mediapipe==0.10.14` |
| `py -3.11` not found | py launcher not installed | Re-run Python installer, enable py launcher |
| `Activate.ps1` blocked | PowerShell execution policy | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first |
| `numpy` dtype errors | numpy 2.x incompatible with TF 2.15 | Ensure `numpy==1.26.4` |
