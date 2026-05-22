from huggingface_hub import list_repo_files

repos = [
    "akasheroor/American-Sign-Language-Dataset",
    "ZahidYasinMittha/American-Sign-Language-Dataset",
    "simplyyousef/American-Sign-Language-Dataset",
]

for repo in repos:
    print("\n===", repo, "===")
    try:
        files = list_repo_files(repo_id=repo, repo_type="dataset")
        print("Total files listed:", len(files))
        print("First 50 files:")
        for f in files[:50]:
            print(" ", f)
        print("Has dataset.csv:", "dataset.csv" in files)
        print("Part folders:", sorted(set(x.split("/")[0] for x in files if "/" in x))[:20])
    except Exception as e:
        print("ERROR:", e)