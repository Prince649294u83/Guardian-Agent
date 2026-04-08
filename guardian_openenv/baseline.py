from __future__ import annotations

from guardian_openenv.inference_runtime import run_inference


def run_baseline(output_path: str = "outputs/baseline_scores.json"):
    return run_inference(
        strict_submission_env=False,
        output_path=output_path,
        log_writer=lambda _line: None,
    )


if __name__ == "__main__":
    summary = run_baseline()
    print(summary.model_dump_json(indent=2))
