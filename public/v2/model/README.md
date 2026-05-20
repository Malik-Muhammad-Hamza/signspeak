# SignSpeak v2 Model Assets

This directory is the **drop target** for the TF.js model exported by `training/05_export_tfjs.py`.

## Expected files after export

```
public/v2/model/
├── model.json            — TF.js model topology + weight manifest
├── label_map.json        — { "0": "HELLO", "1": "THANK_YOU", … }
└── group1-shard*.bin     — Weight binary shards
```

## Before export

This directory ships with no model files.
The React v2 hooks (`useV2Prediction`) gracefully handle the missing model — 
`modelReady` will remain `false` and `error` will be set so the UI can show 
a placeholder state rather than crashing.

## How to populate

```bash
cd training
python 05_export_tfjs.py
# → copies files here automatically
```
