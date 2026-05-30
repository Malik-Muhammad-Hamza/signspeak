"""Lightweight tests for strict HF-ASL filename label matching."""

from __future__ import annotations

import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("00_download_hf_clips.py")
spec = importlib.util.spec_from_file_location("hf_downloader", MODULE_PATH)
hf_downloader = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(hf_downloader)


SELECTED_CLASSES = [
    "HELLO",
    "YES",
    "NO",
    "HELP",
    "THANKYOU",
    "PLEASE",
    "SORRY",
    "GOOD",
    "STOP",
    "WATER",
    "ME",
    "YOU",
    "WANT",
    "NEED",
    "FOOD",
    "MORE",
    "BATHROOM",
    "HOME",
    "SICK",
    "WHERE",
]

ALIASES = {
    "THANKYOU": ["THANKYOU", "THANK YOU"],
    "ME": ["ME", "I"],
    "FOOD": ["FOOD", "EAT"],
    "BATHROOM": ["BATHROOM", "TOILET"],
    "HOME": ["HOME"],
    "SICK": ["SICK"],
    "STOP": ["STOP"],
}


ALIAS_LOOKUP, _ALIASES_BY_CLASS = hf_downloader.build_alias_lookup(
    ALIASES,
    SELECTED_CLASSES,
)


def matched_class(repo_path: str) -> str | None:
    _label, match = hf_downloader.match_repo_path(repo_path, ALIAS_LOOKUP)
    return match["class_name"] if match else None


def assert_match(repo_path: str, expected_class: str) -> None:
    actual = matched_class(repo_path)
    assert actual == expected_class, f"{repo_path}: expected {expected_class}, got {actual}"


def assert_no_match(repo_path: str) -> None:
    actual = matched_class(repo_path)
    assert actual is None, f"{repo_path}: expected no match, got {actual}"


def main() -> None:
    assert_match("part_1/123456-HOME.mp4", "HOME")
    assert_no_match("part_1/123456-HOMEWORK.mp4")

    assert_match("part_1/123456-THANKYOU.mp4", "THANKYOU")
    assert_match("part_1/123456-THANK YOU.mp4", "THANKYOU")
    assert_no_match("part_1/123456-THANKSGIVING.mp4")

    assert_match("part_1/123456-STOP.mp4", "STOP")
    assert_no_match("part_1/123456-STOPWATCH.mp4")

    assert_match("part_1/123456-SICK.mp4", "SICK")
    assert_no_match("part_1/123456-SICKOUT.mp4")

    assert_match("part_1/123456-ME.mp4", "ME")
    assert_match("part_1/123456-I.mp4", "ME")
    assert_no_match("part_1/123456-INTERNET.mp4")
    assert_no_match("part_1/123456-ISRAEL.mp4")

    assert_match("generated/please_video_0.mp4", "PLEASE")
    assert_match("generated/WATER_13.mp4", "WATER")

    print("HF label matching tests passed.")


if __name__ == "__main__":
    main()
